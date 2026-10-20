<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * What a module adds to the setup wizard's page besides its settings
 *
 * Its wording, the browser plugins that draw its steps, the modules those plugins import by name, and the data only
 * its own plugin reads. A module registers its contribution as an item of the `contributions` argument of this
 * module's contribution pool in its own `etc/adminhtml/di.xml`.
 *
 * @api
 */
interface SetupContributionInterface
{
    /**
     * Get the wording the browser shows, translated into the locale of the request asking
     *
     * Translate on every read, not once when the contribution is built: a contribution is shared, so a text
     * translated once would keep the first request's language, and text given through `di.xml` arrives untranslated.
     *
     * A count-dependent text has one key per plural category (`<key>.one`, `<key>.other`); placeholders are `%1` to
     * `%n`.
     *
     * @return array<string, string> Text keyed by phrase key
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getPhrases(): array;

    /**
     * Get the browser plugins that add wizard steps
     *
     * @return array<string, string> The browser module specifier of each plugin, keyed by plugin id
     */
    public function getPlugins(): array;

    /**
     * Get the modules the browser imports by name
     *
     * @return array<string, string> The file id (`Vendor_Module::js/file.js`) of each module, keyed by the name it is
     *     imported by
     */
    public function getImports(): array;

    /**
     * Get the data only the contributing module's own plugin reads
     *
     * Opaque to the wizard. Anything that differs between scopes is keyed inside by scope id (`default`,
     * `website:<id>`, `store:<id>`) for every scope it applies to, since the person switches scope without
     * reloading the page.
     *
     * @return array<string, mixed> Keyed by plugin id
     */
    public function getExtensionData(): array;
}
