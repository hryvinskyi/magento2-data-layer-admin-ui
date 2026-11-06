# Hryvinskyi_DataLayerAdminUi

Admin part of the GA4 data layer: the settings section under Stores > Configuration > Sales > GA4 Data Layer, the events table and the setup wizard (Sales > GA4 Data Layer > Setup).

Part of the GA4 Data Layer for Magento 2. The full user guide, covering setup, every setting and how to check what the store sends, is in [`docs/ga4-data-layer-guide.md`](https://github.com/hryvinskyi/magento2-data-layer/blob/main/docs/ga4-data-layer-guide.md) of `hryvinskyi/magento2-data-layer`.

## Installation

Install all GA4 Data Layer modules with the metapackage:

```bash
composer require hryvinskyi/magento2-data-layer-pack
bin/magento setup:upgrade
bin/magento setup:di:compile
bin/magento cache:flush
```

or this module alone:

```bash
composer require hryvinskyi/magento2-data-layer-admin-ui
```

## Requirements

- PHP ~8.3.0 or ~8.4.0
- `hryvinskyi/magento2-data-layer-api`
- `hryvinskyi/magento2-data-layer`
- `hryvinskyi/magento2-theme-assets`
- `hryvinskyi/magento2-admin-ui`
- Magento 2.4.x

## Look of the setup wizard

The setup wizard is drawn by the shared admin UI kit, `hryvinskyi/magento2-admin-ui`: its typeface (Source Sans 3,
served from the kit's own static files), its `--hui-*` colour tokens and the parts every step composes (buttons,
cards, notices, fields, controls, badges, the status panel). The wizard page loads the kit's stylesheet before its
own, `setup-wizard.css`, which keeps the frame and the steps' own parts.

A theme restyles the wizard by overriding the kit's `--hui-*` custom properties. The root `--hdl-setup-*` tokens of
the wizard 1.0 are still declared, as aliases of the kit tokens, so a stylesheet that reads them keeps its colours;
overriding one of them no longer restyles the parts the kit draws. The status panel's three component-local
properties, `--hdl-setup-status-dot`, `--hdl-setup-status-tile` and `--hdl-setup-status-word`, are not declared any
more: they are now `--hui-status-dot`, `--hui-status-tile` and `--hui-status-word`, set on `.hui-status`. A step plugin's stylesheet selects a kit part by its
`hui-*` class (`.hui-button`, `.hui-field`).
