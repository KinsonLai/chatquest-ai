# Create a world pack

Copy one of `examples/*.json`, change its original content, then pass the object as `create_campaign.world`. Packs are data: no JavaScript, shell commands, SQL, URLs to fetch or external model key. A campaign stores its own immutable copy; editing an example file does not rewrite existing games. The exact pack schema is discoverable through `read_guide(section="tools",tool_name="create_campaign")`.

Required fields:

| Field                              | Meaning                                                                                                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`, `name`, `genre`, `premise`   | Identity and GM starting premise; no universal fantasy assumptions.                                                                                                                                                |
| `player.name`, `player.attributes` | Attribute names are arbitrary; integer modifiers range from-10 to30.                                                                                                                                               |
| `player.vitals`                    | Any named current/max tracks: health, resolve, oxygen, focus, mana. Current stays between0 and max. A zero vital blocks new dice until its condition is resolved.                                                  |
| `actors`                           | IDs mapped to name, optional age, experience, intent and location. Reserve `player` and `gm`. Age/experience guide the model, not a semantic validator.                                                            |
| `initial`                          | Location, nonnegative resources, item counts and goals. Declare explicit game initial values rather than pretending an imported novel provided them.                                                               |
| `rules`                            | Difficulty names/DCs, checks per revision and world tick minutes. The initial die is d20; alternate dice systems are a contribution area, not an advertised feature.                                               |
| `events`                           | Unique ID, title, description, chance0–1, locations, cooldown_minutes, and public/gm visibility. Events are independent seeded opportunities per tick. They do not secretly change resources or control NPC minds. |
| `canon`                            | Original documents `{id,title,text}`. Only distribute material you have permission to share.                                                                                                                       |

The examples intentionally use different genres while sharing some track names to make the first demo easy to follow. Custom packs can choose different attribute, vital, resource and item names. Record new skills, affiliations or cultivation as ordinary facts; typed attribute/vital changes need separate explicit deltas and bases.

## Bring a novel or a setting

Create a pack with a definite starting scene and ledger. Import chapters using `ingest_canon` in small text batches. Retain authorial uncertainty: distinguish source statements from GM assumptions and newly created branch events. Do not distribute private manuscripts with your engine or commit save databases into a public repository.

Canon search is a tool for locating evidence, not proof that every character read the book. `fact_updates.known_by` and `knowledge_updates` model who learned which version. A character's previously observed value remains unchanged when the hidden truth changes.

## Extension points

New transports belong in `src/server.mjs`; new mechanics belong behind validated tool schemas in `src/schema.mjs` and invariant tests in `tests/`. Retrieval can later support embeddings without replacing source hashes and citations. Alternative dice/rule systems, semantic review and multi-tenant OAuth hosting require explicit designs and tests. Keep the server headless.
