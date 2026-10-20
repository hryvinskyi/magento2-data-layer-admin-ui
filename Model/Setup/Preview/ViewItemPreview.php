<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\Event\ViewItemEventBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\PreviewOutcomeInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\NotSentReasonInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewKindInterface;
use Hryvinskyi\DataLayerApi\Api\Data\ItemSubjectInterfaceFactory;
use Magento\Catalog\Api\Data\ProductInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Store\Model\StoreManagerInterface;

/**
 * Previews `view_item` for the chosen product's page in the store view
 *
 * There is nothing to preview without a chosen product, or when the store view does not sell it: it does not exist,
 * is disabled there, or is not assigned to the store view's website.
 */
class ViewItemPreview implements PreviewKindInterface
{
    private const EVENT_NAME = 'view_item';

    /**
     * @param ProductRepositoryInterface $products
     * @param StoreManagerInterface $storeManager
     * @param ViewItemEventBuilderInterface $builder
     * @param ItemSubjectInterfaceFactory $subjectFactory
     * @param NotSentReasonInterface $notSentReason
     * @param PreviewOutcomeInterfaceFactory $outcomeFactory
     */
    public function __construct(
        private readonly ProductRepositoryInterface $products,
        private readonly StoreManagerInterface $storeManager,
        private readonly ViewItemEventBuilderInterface $builder,
        private readonly ItemSubjectInterfaceFactory $subjectFactory,
        private readonly NotSentReasonInterface $notSentReason,
        private readonly PreviewOutcomeInterfaceFactory $outcomeFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function preview(int $storeId, ?int $productId): PreviewOutcomeInterface
    {
        if ($productId === null) {
            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::UNAVAILABLE,
                'reason' => __('Search for a product to see what its page sends.'),
            ]);
        }
        $product = $this->soldProduct($productId, $storeId);
        if ($product === null) {
            return $this->outcomeFactory->create([
                'status' => PreviewOutcomeInterface::UNAVAILABLE,
                'reason' => __('This product is not sold in this store view.'),
            ]);
        }

        $event = $this->builder->build($product);
        if ($event !== null) {
            return $this->outcomeFactory->create(['status' => PreviewOutcomeInterface::SENT, 'event' => $event]);
        }

        $subject = $this->subjectFactory->create(['product' => $product, 'storeId' => $storeId, 'quantity' => 1.0]);

        return $this->outcomeFactory->create([
            'status' => PreviewOutcomeInterface::NOT_SENT,
            'reason' => $this->notSentReason->explain(self::EVENT_NAME, $storeId, [$subject]),
        ]);
    }

    /**
     * Load a product as the store view sells it
     *
     * @param int $productId
     * @param int $storeId
     * @return ProductInterface|null Null when it does not exist, is disabled in the store view or is not assigned to
     *     the store view's website
     */
    private function soldProduct(int $productId, int $storeId): ?ProductInterface
    {
        try {
            $product = $this->products->getById($productId, false, $storeId);
            $websiteId = (int) $this->storeManager->getStore($storeId)->getWebsiteId();
        } catch (NoSuchEntityException) {
            return null;
        }
        $websiteIds = array_map('intval', $product->getExtensionAttributes()?->getWebsiteIds() ?? []);
        if ((int) $product->getStatus() !== Status::STATUS_ENABLED || !in_array($websiteId, $websiteIds, true)) {
            return null;
        }

        return $product;
    }
}
