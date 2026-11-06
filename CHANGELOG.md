# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
