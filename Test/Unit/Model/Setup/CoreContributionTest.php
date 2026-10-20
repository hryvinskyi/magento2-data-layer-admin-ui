<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayer\Test\Unit\DictionaryRenderer;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\CoreContribution;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\MergedContributions;
use Magento\Framework\Phrase;
use Magento\Framework\Phrase\RendererInterface;
use PHPUnit\Framework\TestCase;

/**
 * The shell's wording arrives from the wiring as plain source-language text and is translated each time it is read,
 * so the one shared contribution answers every request in that request's locale; the imports are never translated
 */
class CoreContributionTest extends TestCase
{
    /**
     * The renderer phrases had before the test
     *
     * @var RendererInterface|null
     */
    private ?RendererInterface $renderer = null;

    /**
     * Remember the renderer phrases have before the test
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->renderer = Phrase::getRenderer();
    }

    /**
     * Restore the renderer phrases had before the test
     *
     * @return void
     */
    protected function tearDown(): void
    {
        if ($this->renderer !== null) {
            Phrase::setRenderer($this->renderer);
        }
    }

    /**
     * A contribution built in one locale reads in the locale active when it is read
     *
     * @return void
     */
    public function testPhrasesAreTranslatedWhenRead(): void
    {
        $contribution = new CoreContribution(
            ['wizard.title' => 'Set up GA4 tracking', 'step.counter' => 'Step %1 of %2'],
            ['preact' => 'Shell::js/preact.js']
        );
        $merged = new MergedContributions(ContributionStub::pool($contribution));

        Phrase::setRenderer(new DictionaryRenderer([
            'Set up GA4 tracking' => 'GA4-Tracking einrichten',
            'Step %1 of %2' => 'Schritt %1 von %2',
        ]));
        self::assertSame(
            ['wizard.title' => 'GA4-Tracking einrichten', 'step.counter' => 'Schritt %1 von %2'],
            $contribution->getPhrases()
        );
        self::assertSame('GA4-Tracking einrichten', $merged->getText('wizard.title'));
        self::assertSame(['preact' => 'Shell::js/preact.js'], $contribution->getImports());

        Phrase::setRenderer(new DictionaryRenderer(['Set up GA4 tracking' => 'Configurer le suivi GA4']));
        self::assertSame('Configurer le suivi GA4', $merged->getText('wizard.title'));
        self::assertSame('Step %1 of %2', $contribution->getPhrases()['step.counter']);
    }

    /**
     * A phrase or an import that is not text keyed by text fails when the contribution is built
     *
     * @return void
     */
    public function testUnusableEntriesAreRefused(): void
    {
        foreach ([[['wizard.title' => ['Set up']], []], [[], [3 => 'Shell::js/preact.js']]] as [$phrases, $imports]) {
            try {
                new CoreContribution($phrases, $imports);
                self::fail('The entry is refused.');
            } catch (\InvalidArgumentException $refusal) {
                self::assertStringContainsString('must be text keyed by text', $refusal->getMessage());
            }
        }
    }
}
