<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Preview;

use Hryvinskyi\DataLayer\Api\Event\ViewItemEventBuilderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\NotSentReasonInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Preview\ViewItemPreview;
use Hryvinskyi\DataLayerApi\Api\Data\EventInterface;
use Hryvinskyi\DataLayerApi\Api\Data\ItemSubjectInterface;
use Hryvinskyi\DataLayerApi\Api\Data\ItemSubjectInterfaceFactory;
use Magento\Catalog\Api\Data\ProductExtensionInterface;
use Magento\Catalog\Api\Data\ProductInterface;
use Magento\Catalog\Api\ProductRepositoryInterface;
use Magento\Framework\Exception\NoSuchEntityException;
use Magento\Framework\Phrase;
use Magento\Store\Api\Data\StoreInterface;
use Magento\Store\Model\StoreManagerInterface;
use PHPUnit\Framework\TestCase;

/**
 * A product page preview needs a product the store view sells; with one, it is the event the builder makes, or the
 * reason it made none
 */
class ViewItemPreviewTest extends TestCase
{
    private const STORE_ID = 2;
    private const WEBSITE_ID = 3;
    private const PRODUCT_ID = 40;

    /**
     * Without a chosen product there is nothing to preview
     *
     * @return void
     */
    public function testNoProductIsUnavailable(): void
    {
        $products = $this->createMock(ProductRepositoryInterface::class);
        $products->expects(self::never())->method('getById');

        $outcome = $this->preview($products, $this->builder(null))->preview(self::STORE_ID, null);

        self::assertSame('unavailable', $outcome->getStatus());
        self::assertSame('Search for a product to see what its page sends.', (string) $outcome->getReason());
    }

    /**
     * A product that does not exist, is disabled in the store view or is not in its website is not sold there
     *
     * @return void
     */
    public function testProductNotSoldInTheStoreViewIsUnavailable(): void
    {
        $missing = $this->createMock(ProductRepositoryInterface::class);
        $missing->method('getById')->willThrowException(new NoSuchEntityException(new Phrase('No such product.')));
        $cases = [
            'missing' => $missing,
            'disabled' => $this->products($this->product(2, [self::WEBSITE_ID])),
            'other website' => $this->products($this->product(1, [7])),
            'no website' => $this->products($this->product(1, [])),
        ];

        foreach ($cases as $case => $products) {
            $outcome = $this->preview($products, $this->builder(null))->preview(self::STORE_ID, self::PRODUCT_ID);

            self::assertSame('unavailable', $outcome->getStatus(), $case);
            self::assertSame('This product is not sold in this store view.', (string) $outcome->getReason(), $case);
        }
    }

    /**
     * A product the store view sells is loaded with the store view's values and its event is sent
     *
     * @return void
     */
    public function testSoldProductSendsTheBuiltEvent(): void
    {
        $product = $this->product(1, ['1', (string) self::WEBSITE_ID]);
        $products = $this->createMock(ProductRepositoryInterface::class);
        $products->expects(self::once())->method('getById')
            ->with(self::PRODUCT_ID, false, self::STORE_ID)
            ->willReturn($product);
        $event = $this->createMock(EventInterface::class);

        $outcome = $this->preview($products, $this->builder($event))->preview(self::STORE_ID, self::PRODUCT_ID);

        self::assertSame('sent', $outcome->getStatus());
        self::assertSame($event, $outcome->getEvent());
    }

    /**
     * When the builder makes nothing, the reason is explained for `view_item` with the product as its one subject
     *
     * @return void
     */
    public function testNothingBuiltIsExplained(): void
    {
        $product = $this->product(1, [self::WEBSITE_ID]);
        $subject = $this->createMock(ItemSubjectInterface::class);
        $subjects = $this->createMock(ItemSubjectInterfaceFactory::class);
        $subjects->expects(self::once())->method('create')
            ->with(['product' => $product, 'storeId' => self::STORE_ID, 'quantity' => 1.0])
            ->willReturn($subject);
        $reasons = $this->createMock(NotSentReasonInterface::class);
        $reasons->expects(self::once())->method('explain')
            ->with('view_item', self::STORE_ID, [$subject])
            ->willReturn(new Phrase('The event is switched off.'));

        $outcome = $this->preview($this->products($product), $this->builder(null), $subjects, $reasons)
            ->preview(self::STORE_ID, self::PRODUCT_ID);

        self::assertSame('not_sent', $outcome->getStatus());
        self::assertSame('The event is switched off.', (string) $outcome->getReason());
    }

    /**
     * Build the preview
     *
     * @param ProductRepositoryInterface $products
     * @param ViewItemEventBuilderInterface $builder
     * @param ItemSubjectInterfaceFactory|null $subjects
     * @param NotSentReasonInterface|null $reasons
     * @return ViewItemPreview
     */
    private function preview(
        ProductRepositoryInterface $products,
        ViewItemEventBuilderInterface $builder,
        ?ItemSubjectInterfaceFactory $subjects = null,
        ?NotSentReasonInterface $reasons = null
    ): ViewItemPreview {
        $store = $this->createMock(StoreInterface::class);
        $store->method('getWebsiteId')->willReturn(self::WEBSITE_ID);
        $storeManager = $this->createMock(StoreManagerInterface::class);
        $storeManager->method('getStore')->with(self::STORE_ID)->willReturn($store);

        return new ViewItemPreview(
            $products,
            $storeManager,
            $builder,
            $subjects ?? $this->createMock(ItemSubjectInterfaceFactory::class),
            $reasons ?? $this->createMock(NotSentReasonInterface::class),
            new PreviewOutcomeFactoryStub()
        );
    }

    /**
     * A repository that finds one product
     *
     * @param ProductInterface $product
     * @return ProductRepositoryInterface
     */
    private function products(ProductInterface $product): ProductRepositoryInterface
    {
        $products = $this->createMock(ProductRepositoryInterface::class);
        $products->method('getById')->willReturn($product);

        return $products;
    }

    /**
     * A product with a status and the websites it is assigned to
     *
     * @param int $status 1 enabled, 2 disabled
     * @param list<int|string> $websiteIds
     * @return ProductInterface
     */
    private function product(int $status, array $websiteIds): ProductInterface
    {
        $extension = $this->createMock(ProductExtensionInterface::class);
        $extension->method('getWebsiteIds')->willReturn($websiteIds);
        $product = $this->createMock(ProductInterface::class);
        $product->method('getStatus')->willReturn($status);
        $product->method('getExtensionAttributes')->willReturn($extension);

        return $product;
    }

    /**
     * A builder that returns a fixed event, or nothing
     *
     * @param EventInterface|null $event
     * @return ViewItemEventBuilderInterface
     */
    private function builder(?EventInterface $event): ViewItemEventBuilderInterface
    {
        $builder = $this->createMock(ViewItemEventBuilderInterface::class);
        $builder->method('build')->willReturn($event);

        return $builder;
    }
}
