House Font Drop Zone

This folder is the runtime home for licensed Prometheus house fonts.

Expected structure:

- `public/fonts/house/jugendreisen/Jugendreisen-Regular.otf`
- `public/fonts/house/louize/Louize-Regular.otf`
- `public/fonts/house/louize/Louize-Italic.otf`
- `public/fonts/house/ivar-script/IvarScript-Regular.otf`
- `public/fonts/house/sokoli/Sokoli-Regular.otf`

Current behavior:

- The codebase already knows about these font families.
- They are scaffolded but disabled in `src/lib/cinematic-typography/house-font-registry.ts`.
- Dropping the files here is not enough by itself. After the files are present, flip the matching `enabled` flags to `true`.

Recommended activation order:

1. `Jugendreisen`
2. `Louize`
3. `Ivar Script`
4. `Sokoli`

After enabling any font:

1. Run `npm run typography:graph`
2. Run `npm run typography:audit`
3. Verify the lane moved from `doctrine-only` to runtime-backed in `docs/generated/typography-font-graph-report.md`
