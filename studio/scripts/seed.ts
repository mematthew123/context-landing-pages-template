// Seeds a dataset from a folder of content (see examples/seed in the repo root):
//
//   npx sanity exec scripts/seed.ts --with-user-token -- ../examples/seed
//
//   rules.json            Rule documents (required)
//   library.json          Image library entries, each with a `url` or a `file` path (optional)
//   front-door-<name>.md  Front-door scripts, seeded as frontDoor.<name> (optional). {{projectId}},
//                         {{dataset}}, and {{studioUrl}} are filled in from this Studio's config.
//   briefs/<name>.md      Example Briefs, seeded as brief-<name> without requesting a Build (optional)
import {existsSync, readdirSync, readFileSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const dir = resolve(process.argv[process.argv.length - 1] ?? '')
const client = getCliClient({apiVersion: '2026-11-01'})
const {projectId, dataset} = client.config()
const studioUrl = process.env.SANITY_STUDIO_URL || 'your Studio'
const read = (name: string) => readFileSync(join(dir, name), 'utf8')
const has = (name: string) => existsSync(join(dir, name))

// Only writes Rules that changed: every published Rule write starts a Rules sync
async function seedRules() {
  const rules = JSON.parse(read('rules.json')) as {_id: string; examples?: object[]}[]
  const existing = new Map(
    (await client.fetch<{_id: string; doc: string}[]>(`*[_type == "rule" && !(_id in path("drafts.**"))]{_id, "doc": @}`)).map(
      (rule) => [rule._id, JSON.stringify(rule.doc)],
    ),
  )
  const tx = client.transaction()
  let changed = 0
  for (const rule of rules) {
    const examples = rule.examples?.map((example, i) => ({_key: `e${i}`, _type: 'example', ...example}))
    const doc = {...rule, _type: 'rule', examples}
    const current = existing.get(rule._id)
    if (current && sameFields(JSON.parse(current), doc)) continue
    tx.createOrReplace(doc)
    changed++
  }
  if (changed) await tx.commit()
  console.log(`Seeded ${changed} new or changed Rules (${rules.length} total)`)
}

function sameFields(current: Record<string, unknown>, next: Record<string, unknown>) {
  return Object.keys(next).every((field) => JSON.stringify(current[field]) === JSON.stringify(next[field]))
}

type LibraryEntry = {
  _id?: string
  title: string
  description: string
  kind: 'product-ui' | 'illustration' | 'photo'
  products?: string[]
  url?: string
  file?: string
}

async function seedLibrary() {
  if (!has('library.json')) return
  const entries = JSON.parse(read('library.json')) as LibraryEntry[]
  for (const entry of entries) {
    const {url, file, ...fields} = entry
    const source = url ?? file
    if (!source) throw new Error(`Library entry "${entry.title}" needs a url or a file`)
    const _id = entry._id ?? `libraryImage.${slug(entry.title)}`
    if (await client.fetch<boolean>(`defined(*[_id == $id][0]._id)`, {id: _id})) continue
    const bytes = url
      ? Buffer.from(await (await fetch(url)).arrayBuffer())
      : readFileSync(resolve(dir, file as string))
    const asset = await client.assets.upload('image', bytes, {filename: basename(source)})
    await client.createOrReplace({
      ...fields,
      _id,
      _type: 'libraryImage',
      image: {_type: 'image', asset: {_type: 'reference', _ref: asset._id}, alt: entry.description},
    })
  }
  console.log(`Seeded the Image library (${entries.length} images)`)
}

const FRONT_DOOR_TITLES: Record<string, string> = {
  claude: 'Claude (Sanity connector)',
  slack: 'Slack (Content Agent)',
}

async function seedFrontDoors() {
  await client.createIfNotExists({_id: 'rulesSyncStatus', _type: 'rulesSyncStatus', state: 'current'})
  const files = readdirSync(dir).filter((file) => /^front-door-[a-z0-9-]+\.md$/.test(file))
  for (const file of files) {
    const name = file.replace(/^front-door-|\.md$/g, '')
    const instructions = read(file)
      .replaceAll('{{projectId}}', projectId ?? '')
      .replaceAll('{{dataset}}', dataset ?? '')
      .replaceAll('{{studioUrl}}', studioUrl)
    await client.createOrReplace({
      _id: `frontDoor.${name}`,
      _type: 'frontDoorScript',
      title: FRONT_DOOR_TITLES[name] ?? name,
      instructions,
    })
  }
  console.log(`Seeded the Rules sync status and ${files.length} Front-door scripts`)
}

async function seedBriefs() {
  if (!has('briefs')) return
  const files = readdirSync(join(dir, 'briefs')).filter((file) => /\.(md|txt)$/.test(file))
  for (const file of files) {
    const text = read(join('briefs', file)).replace(/<!--[\s\S]*?-->\s*/g, '').trim()
    const title = text.match(/^#\s+(.+)$/m)?.[1]?.replace(/^Brief:\s*/i, '') ?? file
    await client.createIfNotExists({
      _id: `brief-${slug(file.replace(/\.(md|txt)$/, ''))}`,
      _type: 'brief',
      title,
      text,
      submittedBy: 'Seed',
      submittedVia: 'studio',
      status: 'idle',
    })
  }
  console.log(`Seeded ${files.length} example Briefs (no Build requested)`)
}

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

await seedRules()
await seedLibrary()
await seedFrontDoors()
await seedBriefs()
