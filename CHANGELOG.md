# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2026-11-07

### Changed

- The settings page's own rows (the events table, the status lines and the warning notices) take their look from the shared admin UI kit: the page links the kit's stylesheet before `config-fields.css`, each of those rows carries the kit's token class `hui-tokens` and reads `--hui-*` tokens instead of its own palette, and Magento's form around them keeps the admin theme. The table header is now the kit's neutral grey instead of brown, and the events table's source and fixed-channel labels are the kit's badges (a fixed channel is drawn with a dashed border). `config-fields.css` no longer styles those two labels; a stylesheet that restyled `hryvinskyi-datalayer-events__badge` or `__fixed` must target `hui-badge` or the tokens.
- A warning notice row wraps its box in a `div.hui-tokens` inside its table cell.
- `config-fields.css` no longer styles `.hryvinskyi-datalayer-note--warning`, the warning comment that `hryvinskyi/magento2-data-layer-server-side-admin-ui` prints; that module styles it itself from 1.1.1. `composer.json` declares a conflict with that module below 1.1.1, so the two cannot be installed in a pairing that leaves the warning unstyled.

### Fixed

- The events table's channel select takes the admin control height (3.3rem), so the admin theme's caret sits in its middle instead of below it.

## [1.1.0] - 2026-11-06

### Changed

- The setup wizard's look comes from the shared admin UI kit, `hryvinskyi/magento2-admin-ui`, which this release requires; the wizard page loads the kit's stylesheet before `setup-wizard.css`, and the wizard's root carries the kit's root class `hui` beside `hdl-setup`.
- The typeface (Source Sans 3) moved to the kit: this module no longer ships `view/adminhtml/web/fonts/source-sans-3/`, and the build no longer copies it.
- The kit components the SDK (`@hryvinskyi/datalayer-setup`) exports keep their names and props, and now draw the kit's `hui-*` classes instead of `hdl-setup-*` (`hdl-setup-button` is now `hui-button`, `hdl-setup-field` is now `hui-field`, and so on for buttons, cards, panels, columns, notices, message strips, fields, origin lines, inputs, selects, switches, radios, badges, the status panel and icons). A step plugin's stylesheet that selects an old kit class must move to the `hui-*` class. The frame's parts and the wizard's own hooks keep their `hdl-setup-*` classes (`hdl-setup-origin__action`, `hdl-setup-step__summary`).
- `setup-wizard.css` keeps only the frame and the steps' own parts, on the kit's `--hui-*` tokens; a theme restyles the wizard through the `--hui-*` tokens. The root `--hdl-setup-*` tokens of 1.0 are still declared, as aliases of the kit tokens that replaced them, so stylesheets that read them keep their colours; overriding one of them no longer restyles the parts the kit draws. Three 1.0 properties were not root tokens but component-local properties of the status panel, and are not declared any more: `--hdl-setup-status-dot`, `--hdl-setup-status-tile` and `--hdl-setup-status-word` are now `--hui-status-dot`, `--hui-status-tile` and `--hui-status-word`, set on `.hui-status` (a stylesheet that read or set one of them moves to the new name).

## [1.0.2] - 2026-10-22

### Changed

- Items › Brand attribute, in the settings and in the setup wizard, also lists text attributes; the data layer sends their text as `item_brand` from `hryvinskyi/magento2-data-layer` 1.0.4, which this release requires.

## [1.0.1] - 2026-10-20

### Added

- Sales › GA4 Data Layer › Advanced settings menu item, opening the settings page next to Setup.

## [1.0.0] - 2026-10-20

### Added

- First public release of `Hryvinskyi_DataLayerAdminUi`.
