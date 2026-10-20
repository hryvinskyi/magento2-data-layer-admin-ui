<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\Event\PurchaseEventBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\NotSentReasonInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewKindInterface;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\Api\SortOrderBuilder;
use Magento\Framework\AuthorizationInterface;
use Magento\Sales\Api\Data\OrderInterface;
use Magento\Sales\Api\OrderRepositoryInterface;

/**
 * Previews `purchase` for the store view's latest order, the newest by creation time
 *
 * The preview shows a real order, which is customer data, so only an admin whose role may view orders sees one.
 * Hidden prices never stop a purchase (an order always carries its money), so the viewer chosen changes nothing
 * here, and the chosen product is not used.
 */
class PurchasePreview implements PreviewKindInterface
{
    private const EVENT_NAME = 'purchase';
    private const ORDER_VIEW_RESOURCE = 'Magento_Sales::actions_view';

    /**
     * @param AuthorizationInterface $authorization
     * @param OrderRepositoryInterface $orders
     * @param SearchCriteriaBuilder $criteriaBuilder
     * @param SortOrderBuilder $sortOrderBuilder
     * @param PurchaseEventBuilderInterface $builder
     * @param NotSentReasonInterface $notSentReason
     * @param PreviewOutcomeInterfaceFactory $outcomeFactory
     */
    public function __construct(
        private readonly AuthorizationInterface $authorization,
        private readonly OrderRepositoryInterface $orders,
        private readonly SearchCriteriaBuilder $criteriaBuilder,
        private readonly SortOrderBuilder $sortOrderBuilder,
        private readonly PurchaseEventBuilderInterface $builder,
        private readonly NotSentReasonInterface $notSentReason,
        private readonly PreviewOutcomeInterfaceFactory $outcomeFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function preview(int $storeId, ?int $productId): PreviewOutcomeInterface
    {
        if (!$this->authorization->isAllowed(self::ORDER_VIEW_RESOURCE)) {
            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::UNAVAILABLE,
                'reason' => __('Your role cannot view orders, so no order is previewed.'),
            ]);
        }
        $order = $this->latestOrder($storeId);
        if ($order === null) {
            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::UNAVAILABLE,
                'reason' => __('No orders in this store view yet.'),
            ]);
        }

        $event = $this->builder->build($order);
        if ($event !== null) {
            return $this->outcomeFactory->create(['status' => PreviewOutcomeInterface::SENT, 'event' => $event]);
        }

        return $this->outcomeFactory->create([
            'status' => PreviewOutcomeInterface::NOT_SENT,
            'reason' => $this->notSentReason->explain(self::EVENT_NAME, $storeId),
        ]);
    }

    /**
     * Find the store view's newest order
     *
     * @param int $storeId
     * @return OrderInterface|null Null when the store view has no order
     */
    private function latestOrder(int $storeId): ?OrderInterface
    {
        $newestFirst = $this->sortOrderBuilder->setField(OrderInterface::CREATED_AT)
            ->setDescendingDirection()
            ->create();
        $lastSavedFirst = $this->sortOrderBuilder->setField(OrderInterface::ENTITY_ID)
            ->setDescendingDirection()
            ->create();
        $criteria = $this->criteriaBuilder
            ->addFilter(OrderInterface::STORE_ID, $storeId)
            ->addSortOrder($newestFirst)
            ->addSortOrder($lastSavedFirst)
            ->setPageSize(1)
            ->setCurrentPage(1)
            ->create();
        $orders = $this->orders->getList($criteria)->getItems();

        return $orders === [] ? null : reset($orders);
    }
}
