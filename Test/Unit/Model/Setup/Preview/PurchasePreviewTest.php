<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\Event\PurchaseEventBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\NotSentReasonInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview\PurchasePreview;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Magento\Framework\Api\SearchCriteria;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\Api\SortOrder;
use Magento\Framework\Api\SortOrderBuilder;
use Magento\Framework\AuthorizationInterface;
use Magento\Framework\Phrase;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Api\Data\OrderSearchResultInterface;
use Magento\Sales\Api\OrderRepositoryInterface;
use PHPUnit\Framework\TestCase;

/**
 * A purchase preview shows the store view's latest order to an admin who may view orders; without one, or without
 * the permission, there is nothing to preview
 */
class PurchasePreviewTest extends TestCase
{
    private const STORE_ID = 2;

    /**
     * An admin whose role may not view orders sees none, and no order is read
     *
     * @return void
     */
    public function testRoleWithoutOrderAccessSeesNoOrder(): void
    {
        $orders = $this->createMock(OrderRepositoryInterface::class);
        $orders->expects(self::never())->method('getList');

        $outcome = $this->preview(false, $orders, null)->preview(self::STORE_ID, null);

        self::assertSame('unavailable', $outcome->getStatus());
        self::assertSame('Your role cannot view orders, so no order is previewed.', (string) $outcome->getReason());
    }

    /**
     * A store view without orders has nothing to preview
     *
     * @return void
     */
    public function testStoreViewWithoutOrdersIsUnavailable(): void
    {
        $outcome = $this->preview(true, $this->orders([]), null)->preview(self::STORE_ID, null);

        self::assertSame('unavailable', $outcome->getStatus());
        self::assertSame('No orders in this store view yet.', (string) $outcome->getReason());
    }

    /**
     * The latest order's purchase is sent; the chosen product plays no part
     *
     * @return void
     */
    public function testLatestOrderSendsItsPurchase(): void
    {
        $order = $this->createMock(OrderInterface::class);
        $event = $this->createMock(EventInterface::class);
        $builder = $this->createMock(PurchaseEventBuilderInterface::class);
        $builder->expects(self::once())->method('build')->with($order)->willReturn($event);

        $outcome = $this->preview(true, $this->orders([7 => $order]), $builder)->preview(self::STORE_ID, 40);

        self::assertSame('sent', $outcome->getStatus());
        self::assertSame($event, $outcome->getEvent());
    }

    /**
     * When the builder makes nothing, the reason is explained for `purchase` without subjects: hidden prices never
     * stop a purchase
     *
     * @return void
     */
    public function testNothingBuiltIsExplained(): void
    {
        $builder = $this->createMock(PurchaseEventBuilderInterface::class);
        $builder->method('build')->willReturn(null);
        $reasons = $this->createMock(NotSentReasonInterface::class);
        $reasons->expects(self::once())->method('explain')
            ->with('purchase', self::STORE_ID)
            ->willReturn(new Phrase('Tracking is off.'));

        $outcome = $this->preview(true, $this->orders([$this->createMock(OrderInterface::class)]), $builder, $reasons)
            ->preview(self::STORE_ID, null);

        self::assertSame('not_sent', $outcome->getStatus());
        self::assertSame('Tracking is off.', (string) $outcome->getReason());
    }

    /**
     * Build the preview
     *
     * @param bool $mayViewOrders
     * @param OrderRepositoryInterface $orders
     * @param PurchaseEventBuilderInterface|null $builder
     * @param NotSentReasonInterface|null $reasons
     * @return PurchasePreview
     */
    private function preview(
        bool $mayViewOrders,
        OrderRepositoryInterface $orders,
        ?PurchaseEventBuilderInterface $builder,
        ?NotSentReasonInterface $reasons = null
    ): PurchasePreview {
        $authorization = $this->createMock(AuthorizationInterface::class);
        $authorization->method('isAllowed')->with('Magento_Sales::actions_view')->willReturn($mayViewOrders);
        $sortOrders = $this->createMock(SortOrderBuilder::class);
        $sortOrders->method('setField')->willReturnSelf();
        $sortOrders->method('setDescendingDirection')->willReturnSelf();
        $sortOrders->method('create')->willReturn($this->createMock(SortOrder::class));
        $criteria = $this->createMock(SearchCriteriaBuilder::class);
        $criteria->method('addFilter')->with('store_id', self::STORE_ID)->willReturnSelf();
        $criteria->method('addSortOrder')->willReturnSelf();
        $criteria->method('setPageSize')->with(1)->willReturnSelf();
        $criteria->method('setCurrentPage')->willReturnSelf();
        $criteria->method('create')->willReturn($this->createMock(SearchCriteria::class));

        return new PurchasePreview(
            $authorization,
            $orders,
            $criteria,
            $sortOrders,
            $builder ?? $this->createMock(PurchaseEventBuilderInterface::class),
            $reasons ?? $this->createMock(NotSentReasonInterface::class),
            new PreviewOutcomeFactoryStub()
        );
    }

    /**
     * A repository whose search finds the given orders
     *
     * @param array<int, OrderInterface> $found
     * @return OrderRepositoryInterface
     */
    private function orders(array $found): OrderRepositoryInterface
    {
        $result = $this->createMock(OrderSearchResultInterface::class);
        $result->method('getItems')->willReturn($found);
        $orders = $this->createMock(OrderRepositoryInterface::class);
        $orders->method('getList')->willReturn($result);

        return $orders;
    }
}
