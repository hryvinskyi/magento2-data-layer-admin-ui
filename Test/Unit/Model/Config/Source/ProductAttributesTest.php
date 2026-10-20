<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Config\Source;

use Hryvinskyi\DataLayer\Test\Unit\DictionaryRenderer;
use Hryvinskyi\DataLayerAdminUi\Model\Config\Source\ProductAttributes;
use Magento\Catalog\Api\Data\ProductAttributeInterface;
use Magento\Catalog\Api\Data\ProductAttributeSearchResultsInterface;
use Magento\Catalog\Api\ProductAttributeRepositoryInterface;
use Magento\Framework\Api\SearchCriteria;
use Magento\Framework\Api\SearchCriteriaBuilder;
use Magento\Framework\Phrase;
use Magento\Framework\Phrase\RendererInterface;
use PHPUnit\Framework\TestCase;

/**
 * The leading options come first with their labels translated each time the options are read, then the matching
 * attributes by label
 */
class ProductAttributesTest extends TestCase
{
    /**
     * The renderer phrases had before the test
     *
     * @var RendererInterface|null
     */
    private ?RendererInterface $renderer = null;

    /**
     * Remember the renderer phrases have before the test
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->renderer = Phrase::getRenderer();
    }

    /**
     * Restore the renderer phrases had before the test
     *
     * @return void
     */
    protected function tearDown(): void
    {
        if ($this->renderer !== null) {
            Phrase::setRenderer($this->renderer);
        }
    }

    /**
     * A leading option's label reads in the locale active when the options are read
     *
     * @return void
     */
    public function testLeadingLabelsAreTranslatedWhenRead(): void
    {
        $source = $this->source();

        Phrase::setRenderer(new DictionaryRenderer(['Product ID' => 'Produkt-ID']));
        self::assertSame([
            ['value' => 'entity_id', 'label' => 'Produkt-ID'],
            ['value' => 'sku', 'label' => 'SKU (sku)'],
        ], $source->toOptionArray());

        Phrase::setRenderer(new DictionaryRenderer(['Product ID' => 'ID produit']));
        self::assertSame('ID produit', $source->toOptionArray()[0]['label']);
    }

    /**
     * The source over one text attribute and the product id as its leading option
     *
     * @return ProductAttributes
     */
    private function source(): ProductAttributes
    {
        $attribute = $this->createMock(ProductAttributeInterface::class);
        $attribute->method('getAttributeCode')->willReturn('sku');
        $attribute->method('getDefaultFrontendLabel')->willReturn('SKU');
        $results = $this->createMock(ProductAttributeSearchResultsInterface::class);
        $results->method('getItems')->willReturn([$attribute]);
        $repository = $this->createMock(ProductAttributeRepositoryInterface::class);
        $repository->method('getList')->willReturn($results);
        $criteria = $this->createMock(SearchCriteriaBuilder::class);
        $criteria->method('addFilter')->willReturnSelf();
        $criteria->method('create')->willReturn($this->createMock(SearchCriteria::class));

        return new ProductAttributes(
            $repository,
            $criteria,
            'backend_type',
            ['varchar' => 'varchar'],
            [['value' => 'entity_id', 'label' => 'Product ID']]
        );
    }
}
