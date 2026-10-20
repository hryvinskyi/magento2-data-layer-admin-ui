<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Preview;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayer\Model\EventDispatcher;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventPreviewInterface;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterfaceFactory;
use Hryvinskyi\DataLayerApi\Api\EventDispatcherInterface;
use Magento\Backend\Model\Auth;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\App\Config\MutableScopeConfigInterface;
use Magento\Framework\Serialize\Serializer\Json;
use Magento\Sales\Api\OrderRepositoryInterface;
use Magento\Store\Model\ScopeInterface;
use Magento\TestFramework\Bootstrap as TestBootstrap;
use Magento\TestFramework\Helper\Bootstrap;
use Magento\TestFramework\ObjectManager as TestObjectManager;
use PHPUnit\Framework\TestCase;

/**
 * The event preview, wired by the real container, builds what a page of store view 1 would send with the drafted
 * values instead of the stored ones, and leaves the stored settings, the event sinks and the orders as they were
 *
 * A test that saves an order runs with the application isolated: saving an order can leave the request's session
 * holding a cart that the rolled-back transaction removed, and the next order saved in the same process would refer
 * to it.
 *
 * @phpstan-import-type PreviewAnswer from EventPreviewInterface
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 */
class EventPreviewTest extends TestCase
{
    use PreviewFixtures;

    private const STORE_ID = 1;

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        $auth = $this->service(Auth::class);
        if ($auth->isLoggedIn()) {
            $auth->logout();
        }
    }

    /**
     * The drafted item ID attribute decides the item id, while the stored one is left as it was
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @magentoConfigFixture default_store hryvinskyi_datalayer/item/identifier_attribute sku
     * @return void
     */
    public function testDraftedItemIdDecidesTheItemId(): void
    {
        $productId = $this->createProduct('DL-PV-LAMP', 'Preview lamp');

        $byId = $this->viewItem($productId, true, ['item_id' => 'entity_id']);
        $bySku = $this->viewItem($productId, true, ['item_id' => 'sku']);

        self::assertSame((string) $productId, $this->firstItem($byId)['item_id'] ?? null);
        self::assertSame('DL-PV-LAMP', $this->firstItem($bySku)['item_id'] ?? null);
        self::assertSame('sku', $this->service(ConfigInterface::class)->getIdentifierAttribute(self::STORE_ID));
    }

    /**
     * A visitor who may not see prices, in a store view that sends such events without money, gets the event
     * without `value` and without the item's `price`; a visitor who sees prices gets both
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @magentoConfigFixture default_store hryvinskyi_datalayer/item/hidden_price_handling skip_event
     * @return void
     */
    public function testHiddenPriceSentWithoutMoney(): void
    {
        $productId = $this->createProduct('DL-PV-DESK', 'Preview desk');

        $hidden = $this->viewItem($productId, false, ['hidden_price' => 'omit_price']);
        $visible = $this->viewItem($productId, true, ['hidden_price' => 'omit_price']);

        self::assertSame('sent', $hidden['status']);
        self::assertArrayNotHasKey('value', $this->ecommerce($hidden));
        self::assertArrayNotHasKey('price', $this->firstItem($hidden));
        self::assertArrayHasKey('value', $this->ecommerce($visible));
        self::assertArrayHasKey('price', $this->firstItem($visible));
    }

    /**
     * A visitor who may not see prices, in a store view that sends no such event, gets no event and the reason
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @magentoConfigFixture default_store hryvinskyi_datalayer/item/hidden_price_handling omit_price
     * @return void
     */
    public function testHiddenPriceSkippingTheEvent(): void
    {
        $productId = $this->createProduct('DL-PV-CHAIR', 'Preview chair');

        $answer = $this->viewItem($productId, false, ['hidden_price' => 'skip_event']);

        self::assertSame(
            [
                'status' => 'not_sent',
                'reason' => 'Prices are hidden from this visitor, and this store view sends no ecommerce event then.',
            ],
            $answer
        );
    }

    /**
     * An event switched off in the draft is not sent, and says so, while the stored list does not name it; tracking
     * switched off in the draft says that first
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @magentoConfigFixture default_store hryvinskyi_datalayer/events/disabled add_to_cart
     * @return void
     */
    public function testDraftedSwitchesStopTheEvent(): void
    {
        $productId = $this->createProduct('DL-PV-SHELF', 'Preview shelf');

        $eventOff = $this->viewItem($productId, true, ['events' => ['off' => ['view_item'], 'channels' => []]]);
        $trackingOff = $this->viewItem($productId, true, [
            'enabled' => false,
            'events' => ['off' => ['view_item'], 'channels' => []],
        ]);

        self::assertSame(
            ['status' => 'not_sent', 'reason' => 'This event is switched off for this store view.'],
            $eventOff
        );
        self::assertSame(['status' => 'not_sent', 'reason' => 'Tracking is off for this store view.'], $trackingOff);
        self::assertSame(
            ['add_to_cart'],
            $this->service(ConfigInterface::class)->getDisabledEvents(self::STORE_ID)
        );
        self::assertTrue($this->service(ConfigInterface::class)->isEnabled(self::STORE_ID));
    }

    /**
     * Without a chosen product, or with one the store view does not sell, there is nothing to preview
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @return void
     */
    public function testProductPageNeedsAProductTheStoreViewSells(): void
    {
        $unassigned = $this->createProduct('DL-PV-NOWHERE', 'Preview nowhere', websiteIds: []);

        self::assertSame(
            ['status' => 'unavailable', 'reason' => 'Search for a product to see what its page sends.'],
            $this->preview()->preview(self::STORE_ID, 'view_item', null, true, [])
        );
        self::assertSame(
            ['status' => 'unavailable', 'reason' => 'This product is not sold in this store view.'],
            $this->viewItem($unassigned, true, [])
        );
    }

    /**
     * An admin who may view orders sees the purchase of the store view's latest order
     *
     * @magentoAppIsolation enabled
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @return void
     */
    public function testPurchaseShowsTheLatestOrder(): void
    {
        $productId = $this->createProduct('DL-PV-ORDERED', 'Ordered lamp');
        $this->placeOrder('DLPV-OLDER', $productId, '2020-01-01 00:00:00');
        $this->placeOrder('DLPV-LATEST', $productId);
        $this->signIn();

        $answer = $this->preview()->preview(self::STORE_ID, 'purchase', null, false, []);

        self::assertSame('sent', $answer['status']);
        self::assertSame('DLPV-LATEST', $this->ecommerce($answer)['transaction_id'] ?? null);
    }

    /**
     * A store view without orders has no purchase to preview
     *
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @return void
     */
    public function testNoOrderNoPurchase(): void
    {
        $criteria = $this->fresh(SearchCriteriaBuilder::class)->addFilter('store_id', self::STORE_ID)->create();
        self::assertSame(
            0,
            $this->service(OrderRepositoryInterface::class)->getList($criteria)->getTotalCount(),
            'The sandbox must hold no order of store view 1 for this test.'
        );
        $this->signIn();

        self::assertSame(
            ['status' => 'unavailable', 'reason' => 'No orders in this store view yet.'],
            $this->preview()->preview(self::STORE_ID, 'purchase', null, true, [])
        );
    }

    /**
     * Without a signed-in admin whose role may view orders, no order is shown
     *
     * @magentoAppIsolation enabled
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @return void
     */
    public function testPurchaseNeedsTheOrderPermission(): void
    {
        $this->placeOrder('DLPV-PRIVATE', $this->createProduct('DL-PV-PRIVATE', 'Private lamp'));

        self::assertSame(
            ['status' => 'unavailable', 'reason' => 'Your role cannot view orders, so no order is previewed.'],
            $this->preview()->preview(self::STORE_ID, 'purchase', null, true, [])
        );
    }

    /**
     * Previews hand nothing to the event sinks, though both events are routed to the server and a dispatched event
     * reaches the sink
     *
     * @magentoAppIsolation enabled
     * @magentoConfigFixture default_store hryvinskyi_datalayer/general/enabled 1
     * @return void
     */
    public function testPreviewDispatchesNothing(): void
    {
        $this->routeToTheServer(['view_item', 'purchase']);
        $sink = $this->recordingSink();
        $productId = $this->createProduct('DL-PV-QUIET', 'Quiet lamp');
        $this->placeOrder('DLPV-QUIET', $productId);
        $this->signIn();
        $control = $this->service(EventInterfaceFactory::class)->create(['name' => 'view_item', 'ecommerce' => true]);
        $this->service(EventDispatcherInterface::class)->dispatch($control, self::STORE_ID);
        self::assertSame(['view_item'], $sink->names(), 'a dispatched event reaches the recording sink');
        $sink->forget();

        $viewItem = $this->viewItem($productId, true, []);
        $purchase = $this->preview()->preview(self::STORE_ID, 'purchase', null, true, []);

        self::assertSame('sent', $viewItem['status']);
        self::assertSame('sent', $purchase['status']);
        self::assertSame([], $sink->names());
    }

    /**
     * Preview a product page of store view 1
     *
     * @param int $productId
     * @param bool $priceVisible
     * @param array<string, mixed> $settings
     * @return PreviewAnswer
     */
    private function viewItem(int $productId, bool $priceVisible, array $settings): array
    {
        return $this->preview()->preview(self::STORE_ID, 'view_item', $productId, $priceVisible, $settings);
    }

    /**
     * Get the preview from the container
     *
     * @return EventPreviewInterface
     */
    private function preview(): EventPreviewInterface
    {
        return $this->service(EventPreviewInterface::class);
    }

    /**
     * Get the ecommerce object of a sent event
     *
     * @param PreviewAnswer $answer
     * @return array<mixed>
     */
    private function ecommerce(array $answer): array
    {
        self::assertSame('sent', $answer['status'], (string) json_encode($answer));
        $ecommerce = $answer['event']['ecommerce'] ?? null;
        self::assertIsArray($ecommerce);

        return $ecommerce;
    }

    /**
     * Get the first item of a sent event
     *
     * @param PreviewAnswer $answer
     * @return array<mixed>
     */
    private function firstItem(array $answer): array
    {
        $items = $this->ecommerce($answer)['items'] ?? null;
        self::assertIsArray($items);
        $item = $items[0] ?? null;
        self::assertIsArray($item);

        return $item;
    }

    /**
     * Sign in as the test framework's administrator, whose role may do everything
     *
     * @return void
     */
    private function signIn(): void
    {
        $this->service(Auth::class)->login(TestBootstrap::ADMIN_NAME, TestBootstrap::ADMIN_PASSWORD);
    }

    /**
     * Route events of store view 1 to the server, for the rest of this isolated test
     *
     * @param list<string> $eventNames
     * @return void
     */
    private function routeToTheServer(array $eventNames): void
    {
        $rows = array_map(static fn (string $name): array => ['event' => $name, 'channel' => 'server'], $eventNames);
        $this->service(MutableScopeConfigInterface::class)->setValue(
            'hryvinskyi_datalayer/channels/routing',
            $this->service(Json::class)->serialize($rows),
            ScopeInterface::SCOPE_STORE,
            'default'
        );
    }

    /**
     * Add a recording sink to the event dispatcher the container builds from now on
     *
     * @return RecordingSink
     */
    private function recordingSink(): RecordingSink
    {
        $objectManager = $this->checked(Bootstrap::getObjectManager(), TestObjectManager::class);
        $objectManager->configure([
            EventDispatcher::class => [
                'arguments' => ['sinks' => ['recording' => ['instance' => RecordingSink::class]]],
            ],
        ]);
        $objectManager->removeSharedInstance(EventDispatcher::class);

        return $this->service(RecordingSink::class);
    }
}
