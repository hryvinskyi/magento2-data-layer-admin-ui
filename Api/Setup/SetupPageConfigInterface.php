<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Everything the setup wizard's page hands its browser code: where to send requests and where to leave to, the admin
 * form key and the admin's locale, the wording, the step plugins, the scope to open at, the settings' state and each
 * plugin's own data
 *
 * Every map that may be empty (`phrases`, `extensions`) is an empty object when it is empty, so the configuration
 * encodes to JSON objects throughout.
 *
 * @phpstan-import-type Endpoints from SetupUrlsInterface
 * @phpstan-import-type Plugin from MergedContributionsInterface
 * @phpstan-import-type State from SetupStateProviderInterface
 * @phpstan-type PageConfig array{
 *     endpoints: Endpoints,
 *     formKey: string,
 *     locale: string,
 *     phrases: array<string, string>|\stdClass,
 *     plugins: list<Plugin>,
 *     initialScope: string,
 *     state: State,
 *     extensions: array<string, mixed>|\stdClass
 * }
 * @api
 */
interface SetupPageConfigInterface
{
    /**
     * Build the page configuration
     *
     * @param mixed $website The `website` parameter the page was opened with
     * @param mixed $store The `store` parameter the page was opened with
     * @return PageConfig
     * @throws \LogicException When two contributions clash
     * @throws \InvalidArgumentException When a registered setting has no field on the configuration page
     * @throws \Magento\Framework\Exception\LocalizedException When no form key can be made
     */
    public function build(mixed $website, mixed $store): array;
}
