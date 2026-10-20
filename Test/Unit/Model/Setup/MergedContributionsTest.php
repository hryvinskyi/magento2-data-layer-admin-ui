<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\MergedContributions;
use PHPUnit\Framework\TestCase;

/**
 * Contributions add up in registration order and never replace one another; only an import of the same name from the
 * same file may be given twice
 */
class MergedContributionsTest extends TestCase
{
    /**
     * Phrases, plugins, imports and plugin data of every contribution come out together
     *
     * @return void
     */
    public function testContributionsAddUp(): void
    {
        $merged = new MergedContributions(ContributionStub::pool(
            new ContributionStub(['wizard.title' => 'Set up'], [], ['preact' => 'Shell::js/preact.js']),
            new ContributionStub(
                ['sample.title' => 'Sample'],
                ['sample' => '@sample/plugin'],
                ['preact' => 'Shell::js/preact.js', '@sample/plugin' => 'Sample::js/plugin.js'],
                ['sample' => ['default' => ['queued' => 2]]]
            ),
            new ContributionStub([], ['other' => '@other/plugin'])
        ));

        self::assertSame(['wizard.title' => 'Set up', 'sample.title' => 'Sample'], $merged->getPhrases());
        self::assertSame('Sample', $merged->getText('sample.title'));
        self::assertSame(
            [['id' => 'sample', 'module' => '@sample/plugin'], ['id' => 'other', 'module' => '@other/plugin']],
            $merged->getPlugins()
        );
        self::assertSame(
            ['preact' => 'Shell::js/preact.js', '@sample/plugin' => 'Sample::js/plugin.js'],
            $merged->getImports()
        );
        self::assertSame(['sample' => ['default' => ['queued' => 2]]], $merged->getExtensionData());
    }

    /**
     * A later contribution may not give a phrase key an earlier one gives, whatever its text
     *
     * @return void
     */
    public function testPhraseGivenTwiceFails(): void
    {
        $merged = new MergedContributions(ContributionStub::pool(
            new ContributionStub(['action.close' => 'Close']),
            new ContributionStub(['action.close' => 'Close'])
        ));

        $this->expectException(\LogicException::class);
        $this->expectExceptionMessage('phrase "action.close"');

        $merged->getPhrases();
    }

    /**
     * A plugin id, a plugin's data, or one import name mapped to two files, given twice, fails
     *
     * @return void
     */
    public function testOtherClashesFail(): void
    {
        $clashes = [
            'plugin' => [
                new ContributionStub([], ['sample' => '@a/plugin']),
                new ContributionStub([], ['sample' => '@b/plugin']),
                'getPlugins',
            ],
            'plugin data' => [
                new ContributionStub([], [], [], ['sample' => []]),
                new ContributionStub([], [], [], ['sample' => []]),
                'getExtensionData',
            ],
            'import' => [
                new ContributionStub([], [], ['preact' => 'Shell::js/preact.js']),
                new ContributionStub([], [], ['preact' => 'Other::js/preact.js']),
                'getImports',
            ],
        ];
        foreach ($clashes as $what => [$first, $second, $method]) {
            $merged = new MergedContributions(ContributionStub::pool($first, $second));
            try {
                $merged->{$method}();
                self::fail(sprintf('A clashing %s was merged.', $what));
            } catch (\LogicException $clash) {
                self::assertStringContainsString('Two setup contributions', $clash->getMessage(), $what);
            }
        }
    }

    /**
     * A phrase no contribution gives is a configuration error, not an empty text
     *
     * @return void
     */
    public function testMissingPhraseFails(): void
    {
        $merged = new MergedContributions(ContributionStub::pool(new ContributionStub(['a' => 'A'])));

        $this->expectException(\LogicException::class);

        $merged->getText('wizard.loading');
    }
}
