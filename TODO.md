- [x] Add [Apugli](https://apugli.readthedocs.io/en/latest/) Support
- [x] Add [Epoli](https://epoli-docs.readthedocs.io/en/latest/) Support
- [x] Add [Eggolib](https://eggolib.github.io/latest/) Support
  - [ ] The mod's dev branch has moved past what the published 1.9.x ("latest") docs cover - several entity actions on the docs site (`damage`, `drop_inventory`, `fire_projectile`, `grant_advancement`/`revoke_advancement`, `play_sound`, `remove_power`, `replace_inventory`, `selector_action`, `spawn_entity`) weren't found in the current source; schemas were written from the published docs regardless, since that's what's actually released.
- [x] Add [Skillful](https://skillful-docs.readthedocs.io/en/latest/) Support
- [x] Add [Extra Origins](https://github.com/MoriyaShiine/extra-origins/wiki) Support
- [x] Add [Mob Origins](https://moborigins.ultrusmods.me/en/latest/) Support
- [x] Add [Origins Extra Keybinds](https://www.curseforge.com/minecraft/mc-mods/origins-extra-keybinds) Support
- [x] Add [Origins: Sync](https://modrinth.com/mod/sync) Support
  - [ ] AspectsLib-gated `set_entity_aspects` power and `has_aspect` condition are undocumented upstream - excluded for now.
- [ ] Add [Provi's Origins](https://github.com/Provismet/Provi-Origins/wiki) Support

- [x] Add autocompletion for particles, sounds, entities, blocks, and items.
- [x] Add more autocompletion for string enums.
- [x] Add caching to the mdreader to speed up the build process.

- [ ] Figure out how to add tests for all the schemas, to ensure they are valid.
