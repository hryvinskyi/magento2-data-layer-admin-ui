<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\PatternTranslatorInterface;

/**
 * Translates the PCRE patterns settings are checked with into ECMAScript regular expressions
 *
 * The delimiters are stripped. The `i` modifier becomes the `i` flag; `D` is dropped, since an ECMAScript `$` without
 * the `m` flag already matches only at the very end. Any other modifier is refused, and so is any `(?` group other
 * than a non-capturing group `(?:`, a lookahead `(?=` or a negative lookahead `(?!`, which both engines read alike:
 * an inline modifier, a named or atomic group or a lookbehind could match differently in the browser.
 */
class PatternTranslator implements PatternTranslatorInterface
{
    private const CLOSING_DELIMITERS = ['(' => ')', '[' => ']', '{' => '}', '<' => '>'];
    private const FLAGS = ['i' => 'i', 'D' => ''];
    private const SHARED_GROUPS = ['(?:', '(?=', '(?!'];

    /**
     * @inheritDoc
     */
    public function toEcmaScript(string $pcre): array
    {
        $opening = $pcre[0] ?? '';
        if ($opening === '' || ctype_alnum($opening) || ctype_space($opening) || $opening === '\\') {
            throw new \InvalidArgumentException(sprintf('"%s" does not start with a pattern delimiter.', $pcre));
        }
        $closing = self::CLOSING_DELIMITERS[$opening] ?? $opening;
        $end = strrpos($pcre, $closing);
        if ($end === false || $end === 0) {
            throw new \InvalidArgumentException(sprintf('"%s" has no closing pattern delimiter.', $pcre));
        }
        $source = substr($pcre, 1, $end - 1);
        $flags = '';
        foreach (str_split(substr($pcre, $end + 1)) as $modifier) {
            $flag = self::FLAGS[$modifier] ?? throw new \InvalidArgumentException(sprintf(
                'The pattern "%s" uses the modifier "%s", which the browser cannot apply.',
                $pcre,
                $modifier
            ));
            $flags .= $flag;
        }
        $this->refuseUnsharedGroups($pcre, $source);

        return ['source' => $source, 'flags' => $flags];
    }

    /**
     * Refuse a `(?` group the browser would read differently
     *
     * @param string $pcre The whole pattern, for the error
     * @param string $source The pattern without delimiters
     * @return void
     * @throws \InvalidArgumentException When such a group is found
     */
    private function refuseUnsharedGroups(string $pcre, string $source): void
    {
        $offset = 0;
        while (($at = strpos($source, '(?', $offset)) !== false) {
            $before = substr($source, 0, $at);
            $escaped = (strlen($before) - strlen(rtrim($before, '\\'))) % 2 === 1;
            if (!$escaped && !in_array(substr($source, $at, 3), self::SHARED_GROUPS, true)) {
                throw new \InvalidArgumentException(sprintf(
                    'The pattern "%s" uses a "(?" construct the browser would read differently.',
                    $pcre
                ));
            }
            $offset = $at + 2;
        }
    }
}
