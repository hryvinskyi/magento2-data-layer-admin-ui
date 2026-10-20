<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Hryvinskyi\DataLayerAdminUi\Api\Events\StoredEventSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSaverInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoredSettingsInterface;
use Magento\Framework\App\Config\ReinitableConfigInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\Config\Storage\WriterInterface;
use Magento\Framework\Event\ManagerInterface;
use Magento\Store\Model\ScopeInterface;
use Magento\Store\Model\StoreManagerInterface;
use Magento\TestFramework\Helper\Bootstrap;
use Magento\TestFramework\ObjectManager;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's save through the real container and the configuration model: rows written and removed at each scope,
 * a value the setting's own save rules refuse failing alone, the events setting keeping entries for events no module
 * registers, and the section's change announced once per scope
 *
 * The configuration model commits its own transactions, and a refused save rolls one back, so these tests run without
 * database isolation: each starts with no rows for the paths it touches and puts the rows it found back afterwards.
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation disabled
 */
class SetupSaveTest extends TestCase
{
    use SignsInAdministrator;

    private const ENABLED = 'hryvinskyi_datalayer/general/enabled';
    private const CONTAINER_ID = 'hryvinskyi_datalayer/gtm/container_id';
    private const MEASUREMENT_ID = 'hryvinskyi_datalayer/gtag/measurement_id';
    private const PATHS = [
        self::ENABLED,
        self::CONTAINER_ID,
        self::MEASUREMENT_ID,
        EventsSettingStateInterface::DISABLED_PATH,
        EventsSettingStateInterface::ROUTING_PATH,
    ];
    private const SECTION_CHANGED = 'admin_system_config_changed_section_hryvinskyi_datalayer';

    /**
     * @var array<string, array<string, string|null>>
     */
    private array $snapshot = [];

    /**
     * @var ManagerInterface|null
     */
    private ?ManagerInterface $eventManager = null;

    /**
     * Sign in as the administrator who saves, keep the rows of the paths the tests touch, then remove them
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->signIn();
        $this->snapshot = $this->service(StoredSettingsInterface::class)->read(self::PATHS);
        $this->removeRows();
    }

    /**
     * Put the rows found before the test back, and the event manager the test replaced, and sign the administrator
     * out
     *
     * @return void
     */
    protected function tearDown(): void
    {
        $this->signOut();
        $this->removeRows();
        $writer = $this->service(WriterInterface::class);
        foreach ($this->snapshot as $path => $rows) {
            foreach ($rows as $scopeId => $value) {
                [$scope, $id] = $this->scope($scopeId);
                $writer->save($path, $value ?? '', $scope, $id);
            }
        }
        if ($this->eventManager !== null) {
            $this->objectManager()->addSharedInstance($this->eventManager, ManagerInterface::class, true);
        }
        $this->service(ReinitableConfigInterface::class)->reinit();
    }

    /**
     * A value set at the default scope, a website and a store view is stored there, normalised as the setting's own
     * save normalises it; inheriting at the store view removes its row, and the state no longer reports it
     *
     * @return void
     */
    public function testSetAtEveryScopeAndInheritRemovesTheRow(): void
    {
        [$websiteId, $storeId] = $this->mainScopes();
        $website = 'website:' . $websiteId;
        $store = 'store:' . $storeId;

        $results = $this->saver()->save([
            ['scope' => 'default', 'key' => 'container_id', 'op' => 'set', 'value' => 'GTM-DEF1'],
            ['scope' => $website, 'key' => 'container_id', 'op' => 'set', 'value' => 'GTM-WEB1'],
            ['scope' => $store, 'key' => 'container_id', 'op' => 'set', 'value' => 'GTM-STO1'],
            ['scope' => $store, 'key' => 'measurement_id', 'op' => 'set', 'value' => ' g-abc123 '],
        ]);

        self::assertSame(['saved', 'saved', 'saved', 'saved'], array_column($results, 'status'));
        $stored = $this->stored();
        self::assertSame(
            ['default' => 'GTM-DEF1', $website => 'GTM-WEB1', $store => 'GTM-STO1'],
            $stored[self::CONTAINER_ID] ?? []
        );
        self::assertSame([$store => 'G-ABC123'], $stored[self::MEASUREMENT_ID] ?? []);

        $results = $this->saver()->save([['scope' => $store, 'key' => 'container_id', 'op' => 'inherit']]);

        self::assertSame([['scope' => $store, 'key' => 'container_id', 'status' => 'saved']], $results);
        self::assertSame(
            ['default' => 'GTM-DEF1', $website => 'GTM-WEB1'],
            $this->stored()[self::CONTAINER_ID] ?? []
        );
        self::assertArrayNotHasKey($store, (array) $this->setting('container_id')['values']);
    }

    /**
     * A container id that does not match its format refuses the whole request before anything is written, the
     * scope's valid changes included: the server checks the format itself rather than trusting the browser's check
     *
     * @return void
     */
    public function testValueOutsideItsFormatRefusesTheRequest(): void
    {
        [$websiteId] = $this->mainScopes();
        $website = 'website:' . $websiteId;

        try {
            $this->saver()->save([
                ['scope' => $website, 'key' => 'enabled', 'op' => 'set', 'value' => true],
                ['scope' => $website, 'key' => 'container_id', 'op' => 'set', 'value' => 'not an id'],
                ['scope' => $website, 'key' => 'measurement_id', 'op' => 'set', 'value' => 'G-OK1'],
            ]);
            self::fail('The request was saved.');
        } catch (InvalidSetupRequestException $refusal) {
            self::assertSame(
                '"not an id" is not in the format the setting "container_id" takes.',
                $refusal->getMessage()
            );
        }

        $stored = $this->stored();
        self::assertArrayNotHasKey(self::ENABLED, $stored);
        self::assertArrayNotHasKey(self::MEASUREMENT_ID, $stored);
        self::assertArrayNotHasKey(self::CONTAINER_ID, $stored);
    }

    /**
     * Saving the events setting keeps the stored entries for events no module registers: a website's own, and the
     * ones a store view without rows of its own inherits; a fixed channel is not routed
     *
     * @return void
     */
    public function testEventsSaveKeepsEntriesForUnknownEvents(): void
    {
        [$websiteId, $storeId] = $this->mainScopes();
        $website = 'website:' . $websiteId;
        $store = 'store:' . $storeId;
        $writer = $this->service(WriterInterface::class);
        $writer->save(
            EventsSettingStateInterface::DISABLED_PATH,
            'add_to_cart,no_such_event',
            ScopeInterface::SCOPE_WEBSITES,
            $websiteId
        );
        $writer->save(
            EventsSettingStateInterface::ROUTING_PATH,
            '[{"event":"no_such_routed","channel":"server"}]',
            ScopeInterface::SCOPE_WEBSITES,
            $websiteId
        );

        $results = $this->saver()->save([
            ['scope' => $website, 'key' => 'events', 'op' => 'set', 'value' => [
                'off' => ['view_item'],
                'channels' => ['add_to_cart' => 'server', 'view_item' => 'browser', 'ads_conversion' => 'server'],
            ]],
            ['scope' => $store, 'key' => 'events', 'op' => 'set', 'value' => ['off' => [], 'channels' => []]],
        ]);

        self::assertSame(['saved', 'saved'], array_column($results, 'status'));
        $stored = $this->stored();
        $disabled = $stored[EventsSettingStateInterface::DISABLED_PATH] ?? [];
        self::assertSame('view_item,no_such_event', $disabled[$website] ?? null);
        self::assertSame('no_such_event', $disabled[$store] ?? null);
        $routing = $stored[EventsSettingStateInterface::ROUTING_PATH] ?? [];
        $rows = $this->service(StoredEventSettingsInterface::class);
        self::assertSame([
            ['event' => 'add_to_cart', 'channel' => 'server'],
            ['event' => 'no_such_routed', 'channel' => 'server'],
        ], $rows->routingRows($routing[$website] ?? null));
        self::assertSame(
            [['event' => 'no_such_routed', 'channel' => 'server']],
            $rows->routingRows($routing[$store] ?? null)
        );
    }

    /**
     * Each scope's changes are one configuration save, so the section's change is announced once per scope, for that
     * scope
     *
     * @return void
     */
    public function testSectionChangeIsAnnouncedOncePerScope(): void
    {
        [$websiteId, $storeId] = $this->mainScopes();
        $announced = $this->recordAnnouncements();

        $this->saver()->save([
            ['scope' => 'website:' . $websiteId, 'key' => 'enabled', 'op' => 'set', 'value' => true],
            ['scope' => 'store:' . $storeId, 'key' => 'container_id', 'op' => 'set', 'value' => 'GTM-ONE1'],
            ['scope' => 'website:' . $websiteId, 'key' => 'measurement_id', 'op' => 'set', 'value' => 'G-ONE1'],
            ['scope' => 'store:' . $storeId, 'key' => 'enabled', 'op' => 'set', 'value' => false],
        ]);

        self::assertSame(
            [[(string) $websiteId, ''], ['', (string) $storeId]],
            array_map(
                static fn (array $data): array => [
                    is_scalar($data['website'] ?? null) ? (string) $data['website'] : '',
                    is_scalar($data['store'] ?? null) ? (string) $data['store'] : '',
                ],
                $announced->getArrayCopy()
            )
        );
    }

    /**
     * Replace the event manager with one that records the section's change announcements and passes every event on
     *
     * @return \ArrayIterator<int, array<mixed>> The data of each announcement, filled as they happen
     */
    private function recordAnnouncements(): \ArrayIterator
    {
        $this->eventManager = $this->service(ManagerInterface::class);
        $announced = new \ArrayIterator();
        $recorder = new class ($this->eventManager, $announced, self::SECTION_CHANGED) implements ManagerInterface {
            /**
             * @param ManagerInterface $inner
             * @param \ArrayIterator<int, array<mixed>> $announced
             * @param string $recorded The event recorded
             */
            public function __construct(
                private readonly ManagerInterface $inner,
                private readonly \ArrayIterator $announced,
                private readonly string $recorded
            ) {
            }

            /**
             * @inheritDoc
             *
             * @param string $eventName
             * @param array<mixed> $data
             * @return void
             */
            public function dispatch($eventName, array $data = [])
            {
                if ($eventName === $this->recorded) {
                    $this->announced->append($data);
                }
                $this->inner->dispatch($eventName, $data);
            }
        };
        $this->objectManager()->addSharedInstance($recorder, ManagerInterface::class, true);

        return $announced;
    }

    /**
     * Remove every row of the paths the tests touch
     *
     * @return void
     */
    private function removeRows(): void
    {
        $writer = $this->service(WriterInterface::class);
        foreach ($this->stored() as $path => $rows) {
            foreach (array_keys($rows) as $scopeId) {
                [$scope, $id] = $this->scope($scopeId);
                $writer->delete($path, $scope, $id);
            }
        }
        $this->service(ReinitableConfigInterface::class)->reinit();
    }

    /**
     * Read the stored rows of the paths the tests touch
     *
     * @return array<string, array<string, string|null>>
     */
    private function stored(): array
    {
        return $this->service(StoredSettingsInterface::class)->read(self::PATHS);
    }

    /**
     * Turn a wizard scope id into a config scope and id
     *
     * @param string $scopeId
     * @return array{string, int}
     */
    private function scope(string $scopeId): array
    {
        $parts = explode(':', $scopeId);
        $scope = [
            'default' => ScopeConfigInterface::SCOPE_TYPE_DEFAULT,
            'website' => ScopeInterface::SCOPE_WEBSITES,
            'store' => ScopeInterface::SCOPE_STORES,
        ][$parts[0]] ?? ScopeConfigInterface::SCOPE_TYPE_DEFAULT;

        return [$scope, (int) ($parts[1] ?? 0)];
    }

    /**
     * Find one setting of the current state
     *
     * @param string $key
     * @return array<string, mixed>
     */
    private function setting(string $key): array
    {
        foreach ($this->service(SetupStateProviderInterface::class)->getState()['settings'] as $setting) {
            if ($setting['key'] === $key) {
                return $setting;
            }
        }
        self::fail(sprintf('The state has no setting "%s".', $key));
    }

    /**
     * Get the saver from the container
     *
     * @return SetupSaverInterface
     */
    private function saver(): SetupSaverInterface
    {
        return $this->service(SetupSaverInterface::class);
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
     * Get the test object manager
     *
     * @return ObjectManager
     */
    private function objectManager(): ObjectManager
    {
        $objectManager = Bootstrap::getObjectManager();
        self::assertInstanceOf(ObjectManager::class, $objectManager);

        return $objectManager;
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
