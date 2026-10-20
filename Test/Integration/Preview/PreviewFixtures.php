<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Preview;

use Magento\Catalog\Model\Product;
use Magento\Catalog\Model\Product\Attribute\Source\Status;
use Magento\Catalog\Model\Product\Type;
use Magento\Catalog\Model\Product\Visibility;
use Magento\Catalog\Model\ResourceModel\Product as ProductResource;
use Magento\Sales\Api\OrderRepositoryInterface;
use Magento\Sales\Model\Order;
use Magento\Sales\Model\Order\Address as OrderAddress;
use Magento\Sales\Model\Order\Item as OrderItem;
use Magento\Sales\Model\Order\Payment;
use Magento\TestFramework\Helper\Bootstrap;

/**
 * Builds the catalogue and orders the preview tests read: products saved through their resource model and orders
 * saved through the order repository, inside each test's rolled-back transaction
 */
trait PreviewFixtures
{
    /**
     * Create a simple product of the main website, priced 10
     *
     * @param string $sku
     * @param string $name
     * @param int $status
     * @param int $visibility
     * @param list<int> $websiteIds
     * @return int The product id
     */
    private function createProduct(
        string $sku,
        string $name,
        int $status = Status::STATUS_ENABLED,
        int $visibility = Visibility::VISIBILITY_BOTH,
        array $websiteIds = [1]
    ): int {
        $product = $this->fresh(Product::class);
        $product->setTypeId(Type::TYPE_SIMPLE)
            ->setAttributeSetId(4)
            ->setSku($sku)
            ->setName($name)
            ->setPrice(10)
            ->setVisibility($visibility)
            ->setStatus($status)
            ->setWebsiteIds($websiteIds);
        $this->service(ProductResource::class)->save($product);

        return (int) $product->getId();
    }

    /**
     * Give a product its own name in a store view
     *
     * @param int $productId
     * @param int $storeId
     * @param string $name
     * @return void
     */
    private function nameInStoreView(int $productId, int $storeId, string $name): void
    {
        $resource = $this->service(ProductResource::class);
        $product = $this->fresh(Product::class);
        $product->setStoreId($storeId);
        $resource->load($product, $productId);
        $product->setStoreId($storeId)->setName($name);
        $resource->save($product);
    }

    /**
     * Save a one-line order of store view 1 for a product
     *
     * @param string $incrementId
     * @param int $productId
     * @param string|null $createdAt Null for the time it is saved
     * @return void
     */
    private function placeOrder(string $incrementId, int $productId, ?string $createdAt = null): void
    {
        $order = $this->fresh(Order::class);
        $order->setIncrementId($incrementId)
            ->setState(Order::STATE_PROCESSING)
            ->setStatus('processing')
            ->setStoreId(1)
            ->setSubtotal(20)
            ->setBaseSubtotal(20)
            ->setGrandTotal(20)
            ->setBaseGrandTotal(20)
            ->setOrderCurrencyCode('USD')
            ->setBaseCurrencyCode('USD')
            ->setCustomerIsGuest(1)
            ->setCustomerEmail('buyer@example.test');
        if ($createdAt !== null) {
            $order->setCreatedAt($createdAt);
        }
        foreach (['billing', 'shipping'] as $type) {
            $address = $this->fresh(OrderAddress::class);
            $address->setAddressType($type)
                ->setFirstname('Test')
                ->setLastname('Buyer')
                ->setStreet(['1 Test Street'])
                ->setCity('Testville')
                ->setPostcode('12345')
                ->setCountryId('US')
                ->setRegionId(12)
                ->setTelephone('5555555')
                ->setEmail('buyer@example.test');
            if ($type === 'billing') {
                $order->setBillingAddress($address);
                continue;
            }
            $order->setShippingAddress($address);
        }
        $payment = $this->fresh(Payment::class);
        $payment->setMethod('checkmo');
        $order->setPayment($payment);
        $item = $this->fresh(OrderItem::class);
        $item->setProductId($productId)
            ->setSku('DL-PV-ORDERED')
            ->setName('Ordered lamp')
            ->setProductType('simple')
            ->setQtyOrdered(2)
            ->setPrice(10)
            ->setBasePrice(10)
            ->setRowTotal(20)
            ->setBaseRowTotal(20);
        $order->addItem($item);

        $this->service(OrderRepositoryInterface::class)->save($order);
    }

    /**
     * Get a shared object from the real container, checked to be of the requested type
     *
     * @template T of object
     * @param class-string<T> $type
     * @return T
     */
    private function service(string $type): object
    {
        return $this->checked(Bootstrap::getObjectManager()->get($type), $type);
    }

    /**
     * Create a new object through the real container, checked to be of the requested type
     *
     * @template T of object
     * @param class-string<T> $type
     * @return T
     */
    private function fresh(string $type): object
    {
        return $this->checked(Bootstrap::getObjectManager()->create($type), $type);
    }

    /**
     * Check an object's type
     *
     * @template T of object
     * @param mixed $object
     * @param class-string<T> $type
     * @return T
     */
    private function checked(mixed $object, string $type): object
    {
        if (!$object instanceof $type) {
            throw new \LogicException(sprintf('The container returned an object that is not a %s.', $type));
        }

        return $object;
    }
}
