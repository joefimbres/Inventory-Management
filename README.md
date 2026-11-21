# Hiking Hawaii Cafe inventory

A phone-first list for cafe staff and for Joe, the GM. Anyone on the floor can mark an item low or out, set an on-hand count, and add a note or order quantity. The order list sorts itself by vendor. **Send to Joe** saves that list with a timestamp and shows a summary you can copy or share. Joe marks lines ordered, then received, and can see what is still pending.

There is no login in v1. Nothing on this page sends a text or an email, and the page has no prices.

## Run it locally

```bash
npm install
npm run dev
```

Open the URL Next prints (usually http://localhost:3000) on a phone-sized window. `npm test` checks the order rules. `npm run build` is the production build.

With no environment variables, the page uses the seed list and saves edits in this browser only. A banner at the top says **This phone only**.

## How the floor uses it

1. **Count.** Items are grouped by section (dairy, bakery, produce, syrups, coffee, tea, and the rest). Open a section, then an item. Tap **In stock**, **Low**, or **Out**. On hand and order qty stay blank until someone types a number. Blank is not zero.
2. **Order.** Low and out items are grouped under Sam's Club, Sysco, Triple F, and Other / unknown. Fix the vendor, quantity, or note, or leave a line off the order.
3. **Send to Joe.** The list is marked sent, with the time in Hawaii. Copy the summary or use the phone’s share sheet. v1 does not text or email anyone.
4. **Joe.** Mark a line ordered, then received. Pending lines stay listed until they are received. Undo is there for a mis-tap. Taking a line off is only allowed before it is marked ordered.
5. **Items.** Add or edit the name, category, vendor, unit, and par level. Par stays blank until someone sets it. Estimated items can keep that tag. Discontinued items (soy milk) stay off the order list.

The Nov 20, 2026 floor requests are already marked **Low**, with the quantities that were asked for (2 gal whole milk, 4 qt heavy whipping cream, and so on). On-hand counts and par levels are blank on purpose.

## Seed data

The list merges two sources:

- `data/ingredient-master-list.csv` — menu ingredients, tagged menu-listed, **Estimated**, or **Inferred**. Items that only appear on older menus are tagged **Not on current menu**.
- The Nov 20 tracker — muffins, croissants, papaya, bottled drinks, tea bags, ketchup packets, hot cups, and the other floor requests. Where a tracker row was the same ingredient (hoagie rolls, cremini mushrooms, cookie dough syrup, Royal Kona espresso, and the rest), it updates that row instead of adding a second one.

Soy milk is discontinued and is not on the order. Whole milk (the Sam’s request) is separate from 2% milk and from the generic milk line. Regenerate the seed with `npm run seed` after editing the CSV.

## Shared storage on Vercel

Create the Vercel project with the name **`inventory-management`** and the Next.js preset. Production works without storage; every phone keeps its own copy until a store is connected.

The list is one private JSON file, `inventory/state.json`. The first visit writes the seed list. Later visits load that shared list. If two phones save at once, each save writes only the items that phone changed, on top of the latest copy.

**Vercel Blob (preferred).** Create a private Blob store and connect it to this project. Vercel sets `BLOB_READ_WRITE_TOKEN` for production, preview, and development. Do not commit the token. `/api/state` then reports `"mode": "blob"`, and the “this phone only” banner goes away.

**Upstash Redis (alternative).** Used only when Blob is not configured. Add the free Upstash Redis integration from the Vercel Marketplace (Storage → Marketplace). Do not pick a paid plan. Either pair is enough:

| Variable | Purpose |
| --- | --- |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `KV_REST_API_URL` | Same URL, older Marketplace name |
| `KV_REST_API_TOKEN` | Same token, older Marketplace name |

Redis keeps the list under the key `hhc:inventory:v1`. `/api/state` then reports `"mode": "shared"`.

Copy `.env.example` to `.env.local` for the same variables on your machine. Never commit `.env.local`.

If no store is configured, or the store does not answer, the page falls back to the seed list plus this browser’s `localStorage` and shows the banner.

### Optional PIN

Set `INVENTORY_PIN` to any string. The page then asks for it before loading or saving, and remembers a device for 30 days with an httpOnly cookie. Leave it unset for the open preview. The ingredient list is in this public repo either way; the PIN only gates the live page.
