<div id="toc" align=center>
	<picture>
		<img src="https://github.com/SnaveSutit/origins-mod-vscode-extension/blob/main/icon.png?raw=true" alt="Envbench Logo" width="128" height="128">
	</picture>
	<ul style="list-style: none;">
		<summary>
				<h1>Origins Mod JSON Schemas</h1>
		</summary>
	</ul>
</div>

---

# Features

- Support for the following Origins Add-ons:
  - [Apugli](https://apugli.readthedocs.io/en/latest/)
  - [Epoli](https://epoli-docs.readthedocs.io/en/latest/)
  - [Extra Origins](https://github.com/MoriyaShiine/extra-origins/wiki)
  - [Mob Origins](https://moborigins.ultrusmods.me/en/latest/)
  - [Origins Extra Keybinds](https://www.curseforge.com/minecraft/mc-mods/origins-extra-keybinds)
  - [Provi's Origins](https://github.com/Provismet/Provi-Origins/wiki)
  - [Skillful](https://skillful-docs.readthedocs.io/en/latest/)

> [!IMPORTANT]
> These schemas only officially support the latest version of Origins. If you are using an older version, some fields may be validated incorrectly.

# ⚙️ How to Use

<h3>
	<p><img src="https://upload.wikimedia.org/wikipedia/commons/9/9a/Visual_Studio_Code_1.35_icon.svg" width=20/> &nbsp;Install the VSCode extension</p>
</h3>

You can install our VSCode extension [Origins Mod JSON Schemas](https://marketplace.visualstudio.com/items?itemName=SnaveSutit.origins-mod-helper) to get automatic schema validation and autocompletion.

<h3>
	<p><img src="https://upload.wikimedia.org/wikipedia/commons/9/9c/IntelliJ_IDEA_Icon.svg" width=20/> &nbsp;Add the JSON schemas to IntelliJ IDEA</p>
</h3>

Follow the steps outlined in the [IntelliJ IDEA documentation](https://www.jetbrains.com/help/idea/json.html) to add the JSON schemas to your project.

> [!IMPORTANT]
> IntelliJ IDEA appears to have issues when using our schemas. (See issue #19)
> Validation, and autocompletion may not work as expected, or at all.

### 🎯 Directly in your JSON files

When writing a JSON File, you can add the following field to the top of each JSON file to enable schema validation in most editors:

- For Origins (`data/namespace/origin/`):

  ```json
  "$schema": "https://raw.githubusercontent.com/SnaveSutit/origins-mod-json-schemas/refs/heads/schemas/apoli/origin.json"
  ```

- For Powers (`data/namespace/power/`):

  ```json
  "$schema": "https://raw.githubusercontent.com/SnaveSutit/origins-mod-json-schemas/refs/heads/schemas/apoli/power.json"
  ```

- For Global Powers (`data/namespace/global_power/`):

  ```json
  "$schema": "https://raw.githubusercontent.com/SnaveSutit/origins-mod-json-schemas/refs/heads/schemas/apoli/global_power.json"
  ```

- For Origin Layers (`data/namespace/origin_layer/`):

  ```json
  "$schema": "https://raw.githubusercontent.com/SnaveSutit/origins-mod-json-schemas/refs/heads/schemas/apoli/origin_layer.json"
  ```

- For Skill Trees (`data/namespace/skill_tree/`):

  ```json
  "$schema": "https://raw.githubusercontent.com/SnaveSutit/origins-mod-json-schemas/refs/heads/schemas/apoli/skill_tree.json"
  ```
  ⚠️ Requires the [Skillful](https://skillful-docs.readthedocs.io/en/latest/) mod to be installed!

## 🧑‍💻 Contributing

### 💻 Setting up the Development Environment

1. Fork the repository
2. Open the repository in VSCode
3. Run `yarn install`

### 🛠️ Making Changes

1. Make your changes to the JSON schemas in the `src` folder.
1. Run `yarn dev` - This will start a watcher that will automatically build the schemas when you make changes.

   > [!NOTE]
   > The built schemas are put into the `schemas` folder. You should not make changes to the files in this folder directly, as they will be overwritten by the build process.

1. Assuming you are using VSCode, you can press `F5` to open a new window with the extension loaded.

   - This will allow you to test the schemas while you make changes. You can restart the window by pressing `Ctrl+Shift+P` or `F1` and typing `Developer: Reload Window`.

### 🔀 Creating a PR

Once you are happy with your changes, commit them and open a pull request and assign it to `SnaveSutit`.

If you have any questions, feel free to ask! My username is `SnaveSutit` on Discord, and I'm a member of the official [Origins Mod Discord](https://discord.gg/VdGgwXwWNa).
