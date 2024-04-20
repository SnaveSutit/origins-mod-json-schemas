# Origins Mod JSON Schemas

JSON Schemas for the Origins mod.

For a VSCode extension that implements these schemas, see the [Origins Mod JSON Schemas](https://marketplace.visualstudio.com/items?itemName=SnaveSutit.origins-mod-helper) extension.

### ⚠️ PLEASE report any issues you find via [Github](https://github.com/SnaveSutit/origins-mod-json-schemas/issues/)! ⚠️

It only takes a few minutes of your time, and helps improves the tool for everyone!

## Contributing

If you would like to contribute to the schemas, please follow the steps below:

1. Fork the repository
2. Run `yarn install`
3. Run `yarn dev` - This will automatically build the schemas as you make changes.

   - Please note that you should never modify the `schemas` directory directly. Instead, modify the files in the `src/schemas` directory and run the build script to generate the schemas.

4. If you're using VSCode, you can press `F5` to open a new window with the extension loaded.

   - This will allow you to test the schemas while you make changes. You can restart the window by pressing `Ctrl+Shift+P` or `F1` and typing `Developer: Reload Window`.

5. Once your changes are complete, run `yarn build` to generate a clean build of the schemas.
6. Commit your changes and push them to your fork.
7. Create a pull request to the `main` branch of this repository.
