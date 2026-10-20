<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\InitialScope;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\MergedContributions;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupPageConfig;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupUrls;
use Magento\Backend\Model\UrlInterface;
use Magento\Framework\Data\Form\FormKey;
use Magento\Framework\Locale\ResolverInterface;
use PHPUnit\Framework\TestCase;

/**
 * The page configuration carries the state read once, an address for every scope of that state, the session's form
 * key, the admin's locale, the contributions put together and the scope the request names
 *
 * @phpstan-import-type State from SetupStateProviderInterface
 */
class SetupPageConfigTest extends TestCase
{
    /**
     * Every part of the configuration comes from its source, and the addresses cover every scope of the state
     *
     * @return void
     */
    public function testAssemblesTheConfiguration(): void
    {
        $config = $this->pageConfig(ContributionStub::pool(
            new ContributionStub(['wizard.title' => 'Set up GA4 tracking'], [], ['preact' => 'Shell::js/preact.js']),
            new ContributionStub([], ['sample' => '@sample/plugin'], [], ['sample' => ['flag' => true]])
        ))->build('1', '2');

        self::assertSame([
            'save' => 'https://admin.test/hryvinskyi_datalayer/setup/save',
            'preview' => 'https://admin.test/hryvinskyi_datalayer/setup/preview',
            'products' => 'https://admin.test/hryvinskyi_datalayer/setup/products',
            'session' => 'https://admin.test/hryvinskyi_datalayer/setup/session?_nosecret=1',
            'advanced' => [
                'default' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer',
                'website:1' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer&website=1',
                'store:2' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer&store=2',
            ],
            'close' => [
                'default' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer',
                'website:1' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer&website=1',
                'store:2' => 'https://admin.test/adminhtml/system_config/edit?section=hryvinskyi_datalayer&store=2',
            ],
        ], $config['endpoints']);
        self::assertSame('form-key', $config['formKey']);
        self::assertSame('uk_UA', $config['locale']);
        self::assertSame(['wizard.title' => 'Set up GA4 tracking'], $config['phrases']);
        self::assertSame([['id' => 'sample', 'module' => '@sample/plugin']], $config['plugins']);
        self::assertSame('store:2', $config['initialScope']);
        self::assertEquals($this->state(), $config['state']);
        self::assertSame(['sample' => ['flag' => true]], $config['extensions']);
    }

    /**
     * Without phrases or plugin data the maps are empty objects, and without scope parameters the wizard opens at
     * the default scope
     *
     * @return void
     */
    public function testEmptyMapsAreObjectsAndTheDefaultScopeIsTheFallback(): void
    {
        $config = $this->pageConfig(ContributionStub::pool(new ContributionStub()))->build(null, null);

        self::assertEquals((object) [], $config['phrases']);
        self::assertEquals((object) [], $config['extensions']);
        self::assertSame('{"a":{},"b":{}}', json_encode(['a' => $config['phrases'], 'b' => $config['extensions']]));
        self::assertSame('default', $config['initialScope']);
    }

    /**
     * A phrase two contributions give stops the page from being built
     *
     * @return void
     */
    public function testPhraseCollisionFails(): void
    {
        $config = $this->pageConfig(ContributionStub::pool(
            new ContributionStub(['action.close' => 'Close']),
            new ContributionStub(['action.close' => 'Shut'])
        ));

        $this->expectException(\LogicException::class);

        $config->build(null, null);
    }

    /**
     * Build the page configuration over the contributions given and fakes of the rest
     *
     * @param SetupContributionsInterface $contributions
     * @return SetupPageConfig
     */
    private function pageConfig(SetupContributionsInterface $contributions): SetupPageConfig
    {
        $state = $this->state();
        $stateProvider = $this->createMock(SetupStateProviderInterface::class);
        $stateProvider->expects(self::once())->method('getState')->willReturn($state);
        $urlBuilder = $this->createMock(UrlInterface::class);
        $urlBuilder->method('getUrl')->willReturnCallback(
            static function (?string $route = null, ?array $params = null): string {
                $query = $params === null || $params === [] ? '' : '?' . http_build_query($params);

                return 'https://admin.test/' . $route . $query;
            }
        );
        $formKey = $this->createMock(FormKey::class);
        $formKey->method('getFormKey')->willReturn('form-key');
        $locale = $this->createMock(ResolverInterface::class);
        $locale->method('getLocale')->willReturn('uk_UA');

        return new SetupPageConfig(
            $stateProvider,
            new MergedContributions($contributions),
            new SetupUrls($urlBuilder, new ScopeIdFactoryStub()),
            new InitialScope(),
            $formKey,
            $locale
        );
    }

    /**
     * A state with the default scope, one website and one of its store views
     *
     * @return State
     */
    private function state(): array
    {
        return [
            'scopes' => [
                ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => 'default', 'parent' => null],
                ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'parent' => 'default'],
                ['id' => 'store:2', 'type' => 'store', 'name' => 'English', 'code' => 'en', 'parent' => 'website:1'],
            ],
            'settings' => [],
            'events' => [
                'catalogue' => [],
                'presets' => [],
                'builtIn' => ['off' => [], 'channels' => (object) []],
                'values' => (object) [],
                'locks' => (object) [],
            ],
        ];
    }
}
