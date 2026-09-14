# OpenAPI
## Test inventory FULL and DELTA

The inventory scenario script sends a representative FULL catalog followed by a
DELTA that updates price and stock, disables an item, and adds a new item.

Set INVENTORY_APP_SECRET in .env, choose a 99Food test store, and run:

    npm run test:inventory -- --store-id=156 --allow-full

The --allow-full option is mandatory because FULL can replace the complete
catalog of the selected store. To inspect both payloads without sending them:

    npm run test:inventory -- --store-id=156 --allow-full --dry-run

Run only one scenario with --scenario=full or --scenario=delta. Use
--base-url=https://your-api.example.com when testing a deployed environment.
The output includes the x-request-id returned by the API so each execution can
be found in the Inventory Activity screen. By default the script waits three
seconds between FULL and DELTA; customize this with --delay-ms=10000 if needed.
