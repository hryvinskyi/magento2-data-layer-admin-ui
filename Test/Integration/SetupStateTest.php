<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Magento\Framework\App\Config\ReinitableConfigInterface;
use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Store\Model\ScopeInterface;
use Magento\Store\Model\StoreManagerInterface;
use Magento\TestFramework\Helper\Bootstrap;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's state, read through the real container from the database, the shipped config and the configuration
 * page's fields: stored rows under their scope ids, shipped defaults, labels and options, the events setting, and a
 * setting the environment fixes
 *
 * @phpstan-import-type State from SetupStateProviderInterface
 * @phpstan-import-type Setting from SetupStateProviderInterface
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 */
class SetupStateTest extends TestCase
{
    use SignsInAdministrator;

    private const CONTAINER_ID = 'hryvinskyi_datalayer/gtm/container_id';
    private const DISABLED_EVENTS = 'hryvinskyi_datalayer/events/disabled';
    private const ROUTING = 'hryvinskyi_datalayer/channels/routing';
    private const ORPHAN_STORE_ID = 987654;
    private const ENV_LOCK = 'CONFIG__WEBSITES__BASE__HRYVINSKYI_DATALAYER__GTM__CONTAINER_ID';

    /**
     * Read the state as the signed-in administrator the wizard's page is opened by
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->signIn();
    }

    /**
     * Remove the row of the store view that does not exist, then forget a lock set by a test and the config read
     * under it, and sign the administrator out
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->signOut();
        // A row of a store view that does not exist stops the application from starting, so it is removed even when
        // the rolled-back transaction did not take it away
        $this->service(WriterInterface::class)->delete(
            self::CONTAINER_ID,
            ScopeInterface::SCOPE_STORES,
            self::ORPHAN_STORE_ID
        );
        if (isset($_ENV[self::ENV_LOCK])) {
            unset($_ENV[self::ENV_LOCK]);
            $this->service(ReinitableConfigInterface::class)->reinit();
        }
    }

    /**
     * Rows stored at the default scope, a website and a store view are reported under `default`, `website:<id>` and
     * `store:<id>`; a row of a store view that does not exist is not reported, nor is its scope
     *
     * @return void
     */
    public function testStoredRowsAppearUnderTheirScopeIds(): void
    {
        [$websiteId, $storeId] = $this->mainScopes();
        $writer = $this->service(WriterInterface::class);
        $writer->save(self::CONTAINER_ID, 'GTM-DEF');
        $writer->save(self::CONTAINER_ID, 'GTM-WEB', ScopeInterface::SCOPE_WEBSITES, $websiteId);
        $writer->save(self::CONTAINER_ID, 'GTM-STORE', ScopeInterface::SCOPE_STORES, $storeId);
        $writer->save(self::CONTAINER_ID, 'GTM-ORPHAN', ScopeInterface::SCOPE_STORES, self::ORPHAN_STORE_ID);

        $state = $this->state();
        $containerId = $this->setting($state, 'container_id');

        $values = $containerId['values'];
        self::assertIsArray($values);
        self::assertSame(
            ['default' => 'GTM-DEF', 'website:' . $websiteId => 'GTM-WEB', 'store:' . $storeId => 'GTM-STORE'],
            array_intersect_key($values, ['default' => 1, 'website:' . $websiteId => 1, 'store:' . $storeId => 1])
        );
        self::assertArrayNotHasKey('store:' . self::ORPHAN_STORE_ID, $values);
        $scopes = array_column($state['scopes'], null, 'id');
        self::assertArrayNotHasKey('store:' . self::ORPHAN_STORE_ID, $scopes);
        self::assertSame('default', $state['scopes'][0]['id']);
        self::assertArrayHasKey('store:' . $storeId, $scopes);
        self::assertSame('website:' . $websiteId, $scopes['store:' . $storeId]['parent']);
        self::assertSame('store', $scopes['store:' . $storeId]['type']);
    }

    /**
     * A setting carries the shipped value from config.xml, not a stored default, and its field's label, options and
     * reach from the configuration page; a pattern travels translated
     *
     * @return void
     */
    public function testSettingsCarryShippedValuesAndTheirFields(): void
    {
        $state = $this->state();

        $scriptHost = $this->setting($state, 'script_host');
        self::assertSame('www.googletagmanager.com', $scriptHost['builtIn']);
        self::assertSame('Script host', $scriptHost['label']);
        self::assertSame('store', $scriptHost['reach']);
        self::assertSame('i', ($scriptHost['pattern'] ?? [])['flags'] ?? null);

        $enabled = $this->setting($state, 'enabled');
        self::assertFalse($enabled['builtIn']);
        self::assertSame('flag', $enabled['kind']);

        $itemId = $this->setting($state, 'item_id');
        self::assertSame('Item ID attribute', $itemId['label']);
        self::assertContains(['value' => 'entity_id', 'label' => 'Product ID'], $itemId['options']);
        self::assertContains('sku', array_column($itemId['options'], 'value'));

        self::assertTrue($this->setting($state, 'measurement_id')['caseInsensitive'] ?? false);
        self::assertSame(
            '{}',
            json_encode($this->setting($state, 'list_view')['values'], JSON_THROW_ON_ERROR)
        );
    }

    /**
     * The events setting reports known events off at the scope that stores them, leaves an unknown event's entry
     * out, and routes per the stored rows
     *
     * @return void
     */
    public function testEventsSettingReportsKnownEventsPerScope(): void
    {
        [$websiteId, $storeId] = $this->mainScopes();
        $writer = $this->service(WriterInterface::class);
        $writer->save(self::DISABLED_EVENTS, 'add_to_cart,no_such_event', ScopeInterface::SCOPE_WEBSITES, $websiteId);
        $writer->save(
            self::ROUTING,
            '[{"event":"add_to_wishlist","channel":"server"}]',
            ScopeInterface::SCOPE_STORES,
            $storeId
        );

        $events = $this->state()['events'];

        self::assertContains('add_to_cart', array_column($events['catalogue'], 'name'));
        self::assertNotSame([], $events['presets']);
        $values = $events['values'];
        self::assertIsArray($values);
        self::assertSame(['add_to_cart'], $values['website:' . $websiteId]['off'] ?? null);
        self::assertSame(['add_to_cart'], $values['store:' . $storeId]['off'] ?? null);
        self::assertSame(['add_to_wishlist' => 'server'], $values['store:' . $storeId]['channels']);
    }

    /**
     * The configuration page's field that stores its rows under another path is found by that path
     *
     * @return void
     */
    public function testFieldIsFoundByTheConfigPathItStoresUnder(): void
    {
        $routing = $this->service(SettingPresentationInterface::class)->present('events', self::ROUTING);

        self::assertSame('Event routing', $routing['label']);
        self::assertSame('store', $routing['reach']);
    }

    /**
     * A path with no field on the configuration page is refused, naming the setting
     *
     * @return void
     */
    public function testPathWithoutFieldIsRefused(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('The wizard setting "mistyped"');

        $this->service(SettingPresentationInterface::class)->present('mistyped', 'hryvinskyi_datalayer/gtm/nowhere');
    }

    /**
     * A setting the environment fixes for a website is locked there, and the website reports the fixed value
     *
     * @magentoAppIsolation enabled
     * @return void
     */
    public function testEnvironmentLockIsReported(): void
    {
        [$websiteId] = $this->mainScopes();
        $this->service(WriterInterface::class)->save(
            self::CONTAINER_ID,
            'GTM-STORED',
            ScopeInterface::SCOPE_WEBSITES,
            $websiteId
        );
        $_ENV[self::ENV_LOCK] = 'GTM-ENVLOCK';
        $this->service(ReinitableConfigInterface::class)->reinit();

        $containerId = $this->setting($this->state(), 'container_id');

        self::assertSame(['website:' . $websiteId], array_keys((array) $containerId['locks']));
        self::assertSame('GTM-ENVLOCK', ((array) $containerId['values'])['website:' . $websiteId] ?? null);
    }

    /**
     * The shell's contribution is registered with the shared browser modules
     *
     * @return void
     */
    public function testShellContributionIsRegistered(): void
    {
        $imports = [];
        foreach ($this->service(SetupContributionsInterface::class)->getContributions() as $contribution) {
            $imports += $contribution->getImports();
        }

        self::assertSame(
            'Hryvinskyi_DataLayerAdminUi::js/setup/sdk.js',
            $imports['@hryvinskyi/datalayer-setup'] ?? null
        );
        self::assertArrayHasKey('preact/jsx-runtime', $imports);
    }

    /**
     * Read the state through the container
     *
     * @return State
     */
    private function state(): array
    {
        return $this->service(SetupStateProviderInterface::class)->getState();
    }

    /**
     * Find one setting of the state
     *
     * @param State $state
     * @param string $key
     * @return Setting
     */
    private function setting(array $state, string $key): array
    {
        foreach ($state['settings'] as $setting) {
            if ($setting['key'] === $key) {
                return $setting;
            }
        }
        self::fail(sprintf('The state has no setting "%s".', $key));
    }

    /**
     * Get the ids of the main website and its default store view
     *
     * @return array{int, int}
     */
    private function mainScopes(): array
    {
        $storeManager = $this->service(StoreManagerInterface::class);

        return [(int) $storeManager->getWebsite('base')->getId(), (int) $storeManager->getStore('default')->getId()];
    }

    /**
     * Get a service from the container
     *
     * @template T of object
     * @param class-string<T> $type
     * @return T
     */
    private function service(string $type): object
    {
        $service = Bootstrap::getObjectManager()->get($type);
        self::assertInstanceOf($type, $service);

        return $service;
    }
}
