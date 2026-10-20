<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\PatternTranslator;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The server's patterns reach the browser as ECMAScript source and flags; a pattern the browser would read
 * differently is refused
 */
class PatternTranslatorTest extends TestCase
{
    /**
     * Every pattern the wizard's settings use translates, delimiters stripped, `i` kept and `D` dropped
     *
     * @param string $pcre
     * @param array{source: string, flags: string} $expected
     * @return void
     */
    #[DataProvider('translatablePatterns')]
    public function testPatternTranslates(string $pcre, array $expected): void
    {
        self::assertSame($expected, (new PatternTranslator())->toEcmaScript($pcre));
    }

    /**
     * Patterns that translate, with their translation
     *
     * @return array<string, array{string, array{source: string, flags: string}}>
     */
    public static function translatablePatterns(): array
    {
        return [
            'container id' => [
                ConfigInterface::CONTAINER_ID_PATTERN,
                ['source' => '^GTM-[A-Z0-9]+$', 'flags' => ''],
            ],
            'measurement id' => [
                ConfigInterface::MEASUREMENT_ID_PATTERN,
                ['source' => '^G-[A-Z0-9]+$', 'flags' => ''],
            ],
            'script host' => [
                ConfigInterface::SCRIPT_HOST_PATTERN,
                [
                    'source' => '^(?=.{1,253}\.?$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?'
                        . '(?:(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+\.?|\.)$',
                    'flags' => 'i',
                ],
            ],
            'ads conversion id' => [
                ConfigInterface::ADS_CONVERSION_ID_PATTERN,
                ['source' => '^AW-\d+$', 'flags' => ''],
            ],
            'other delimiter, slash inside' => ['#^a/b$#', ['source' => '^a/b$', 'flags' => '']],
            'bracket delimiters' => ['{^x+$}i', ['source' => '^x+$', 'flags' => 'i']],
            'escaped group opener' => ['/^\(?x\)?$/', ['source' => '^\(?x\)?$', 'flags' => '']],
            'negative lookahead' => ['/^(?!www\.)x$/', ['source' => '^(?!www\.)x$', 'flags' => '']],
        ];
    }

    /**
     * A modifier other than `i` and `D`, a `(?` construct other than the shared ones, or a missing delimiter is
     * refused
     *
     * @param string $pcre
     * @return void
     */
    #[DataProvider('untranslatablePatterns')]
    public function testPatternIsRefused(string $pcre): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new PatternTranslator())->toEcmaScript($pcre);
    }

    /**
     * Patterns that are refused
     *
     * @return array<string, array{string}>
     */
    public static function untranslatablePatterns(): array
    {
        return [
            'multiline modifier' => ['/^x$/m'],
            'unicode modifier' => ['/^x$/u'],
            'extended modifier' => ['/^ x $/x'],
            'inline modifier' => ['/(?i)^x$/'],
            'named group' => ['/^(?<id>x)$/'],
            'python named group' => ['/^(?P<id>x)$/'],
            'atomic group' => ['/^(?>x)$/'],
            'lookbehind' => ['/(?<=a)x/'],
            'escaped backslash before a group' => ['/^\\\\(?i)x$/'],
            'no delimiter' => ['^x$'],
            'no closing delimiter' => ['/^x$'],
            'empty' => [''],
        ];
    }
}
