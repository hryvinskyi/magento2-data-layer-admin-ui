<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

/**
 * Turns a PHP (PCRE) pattern into the source and flags of an ECMAScript regular expression that matches the same
 * values, so the browser checks a value with the server's own pattern
 *
 * @api
 */
interface PatternTranslatorInterface
{
    /**
     * Translate a pattern
     *
     * @param string $pcre A PCRE pattern with its delimiters and modifiers
     * @return array{source: string, flags: string}
     * @throws \InvalidArgumentException When the pattern uses a modifier or a construct the browser would read
     *     differently
     */
    public function toEcmaScript(string $pcre): array;
}
