<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * What every module's contribution adds to the setup wizard's page, put together
 *
 * Contributions add to one another and never replace: a phrase key, a plugin id or a plugin's extension data given by
 * two contributions, or one import name mapped to two different files, is a configuration error that fails loudly
 * rather than letting the later module silently win.
 *
 * @phpstan-type Plugin array{id: string, module: string}
 * @api
 */
interface MergedContributionsInterface
{
    /**
     * Get the wording of every contribution
     *
     * @return array<string, string> Translated text keyed by phrase key
     * @throws \LogicException When two contributions give the same phrase key
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getPhrases(): array;

    /**
     * Get one phrase
     *
     * @param string $key
     * @return string The translated text
     * @throws \LogicException When no contribution gives the phrase, or two give it
     * @phpstan-impure The answer follows the locale active when it is read
     */
    public function getText(string $key): string;

    /**
     * Get the browser plugins of every contribution
     *
     * @return list<Plugin> In the order the contributions are registered
     * @throws \LogicException When two contributions name the same plugin id
     */
    public function getPlugins(): array;

    /**
     * Get the modules the browser imports by name, of every contribution
     *
     * @return array<string, string> File ids keyed by the name each module is imported by
     * @throws \LogicException When two contributions map one name to two different files
     */
    public function getImports(): array;

    /**
     * Get the data each plugin reads
     *
     * @return array<string, mixed> Keyed by plugin id
     * @throws \LogicException When two contributions give data for the same plugin id
     */
    public function getExtensionData(): array;
}
