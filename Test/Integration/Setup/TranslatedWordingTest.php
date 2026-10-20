<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Hryvinskyi\DataLayer\Test\Unit\DictionaryRenderer;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupPageConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Test\Integration\SignsInAdministrator;
use Magento\Framework\Phrase;
use Magento\Framework\Phrase\RendererInterface;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's wording, event labels and preset labels come from the wiring as plain source-language text, since the
 * object manager does not translate it, and the page configuration translates them into the locale active when it is
 * built: the shared objects that hold them, built while another locale was active, still answer in the new one
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 */
class TranslatedWordingTest extends TestCase
{
    use ResolvesServices;
    use SignsInAdministrator;

    /**
     * The renderer phrases had before the test
     *
     * @var RendererInterface|null
     */
    private ?RendererInterface $renderer = null;

    /**
     * Remember the renderer phrases have before the test, and sign in as the administrator who opens the page
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->renderer = Phrase::getRenderer();
        $this->signIn();
    }

    /**
     * Sign the administrator out and restore the renderer phrases had before the test
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->signOut();
        if ($this->renderer !== null) {
            Phrase::setRenderer($this->renderer);
        }
    }

    /**
     * A page configuration built in a locale with translations reads in it: the shell's title, an event's label and
     * group, and a preset's label
     *
     * @return void
     */
    public function testPageConfigurationReadsInTheActiveLocale(): void
    {
        $pageConfig = $this->service(SetupPageConfigInterface::class);
        $english = $pageConfig->build(null, null);
        self::assertSame('Set up GA4 tracking', $this->phrase($english, 'wizard.title'));

        Phrase::setRenderer(new DictionaryRenderer([
            'Set up GA4 tracking' => 'Configurer le suivi GA4',
            'View item' => 'Article consulté',
            'Browsing' => 'Navigation',
            'Standard online shop' => 'Boutique en ligne standard',
        ]));
        $french = $this->service(SetupPageConfigInterface::class)->build(null, null);

        self::assertSame('Configurer le suivi GA4', $this->phrase($french, 'wizard.title'));
        $viewItem = $this->catalogueEntry($french, 'view_item');
        self::assertSame('Article consulté', $viewItem['label'] ?? null);
        self::assertSame('Navigation', $viewItem['group'] ?? null);
        self::assertSame('browsing', $viewItem['groupCode'] ?? null);
        $presetLabels = array_column($french['state']['events']['presets'], 'label');
        self::assertContains('Boutique en ligne standard', $presetLabels);
    }

    /**
     * Read one phrase of a page configuration
     *
     * @param array<string, mixed> $config
     * @param string $key
     * @return mixed
     */
    private function phrase(array $config, string $key): mixed
    {
        $phrases = $config['phrases'] ?? null;
        self::assertIsArray($phrases);

        return $phrases[$key] ?? null;
    }

    /**
     * Find an event of the catalogue a page configuration carries
     *
     * @param array<string, mixed> $config
     * @param string $name
     * @return array<mixed>
     */
    private function catalogueEntry(array $config, string $name): array
    {
        $state = $config['state'] ?? null;
        self::assertIsArray($state);
        self::assertIsArray($state['events'] ?? null);
        self::assertIsArray($state['events']['catalogue'] ?? null);
        foreach ($state['events']['catalogue'] as $entry) {
            if (is_array($entry) && ($entry['name'] ?? null) === $name) {
                return $entry;
            }
        }
        self::fail(sprintf('The catalogue has no event "%s".', $name));
    }
}
