<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Hryvinskyi\DataLayerAdminUi\Model\Config\Source\CheckoutStepValueBasisOptions;
use Magento\Config\Model\Config\Structure;
use Magento\Config\Model\Config\Structure\Element\Section;
use Magento\Framework\Acl\Builder;
use Magento\Config\Model\ConfigFactory;
use Magento\Config\Model\ResourceModel\Config\Data\CollectionFactory;
use Magento\Framework\Data\OptionSourceInterface;
use Magento\Framework\Exception\LocalizedException;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The settings section renders in the admin, saves what the admin posts, and refuses values the storefront could
 * not use, with the wording the form's own checks show
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 */
class AdminSettingsTest extends TestCase
{
    use RendersSettingsForm;

    private const SECTION = 'hryvinskyi_datalayer';
    private const ACL_RESOURCE = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * The section renders every group for an administrator; the routing rows have no group of their own any more,
     * the events table posts them
     *
     * @magentoAppIsolation enabled
     * @return void
     */
    public function testSectionRendersEveryGroup(): void
    {
        $form = $this->settingsForm(self::SECTION)->getForm();
        foreach (['general', 'gtm', 'gtag', 'events', 'item', 'checkout', 'purchase', 'ads', 'lists'] as $group) {
            self::assertNotNull($form->getElement(self::SECTION . '_' . $group), $group);
        }
        self::assertNull($form->getElement(self::SECTION . '_channels'));
        self::assertNotNull($form->getElement(self::SECTION . '_events_routing'));
        $this->signOut();
    }

    /**
     * The section sits in the Sales tab, guarded by this module's own access rule, which the access list knows and
     * grants an administrator; the rule's former id is gone
     *
     * @magentoAppIsolation enabled
     * @return void
     */
    public function testSectionIsGuardedByTheModulesOwnAclResource(): void
    {
        $acl = $this->service(Builder::class)->getAcl();
        self::assertTrue($acl->hasResource(self::ACL_RESOURCE));
        self::assertFalse($acl->hasResource('Hryvinskyi_DataLayer::config'));

        $this->settingsForm(self::SECTION);
        $section = $this->service(Structure::class)->getElement(self::SECTION);
        self::assertInstanceOf(Section::class, $section);
        self::assertSame(self::ACL_RESOURCE, $section->getAttribute('resource'));
        self::assertSame('sales', $section->getAttribute('tab'));
        self::assertTrue($section->isAllowed());
        $this->signOut();
    }

    /**
     * A container id and a script host are stored trimmed and normalised
     *
     * @return void
     */
    public function testValidLoaderSettingsAreNormalised(): void
    {
        $this->save([
            'gtm' => [
                'fields' => [
                    'container_id' => ['value' => ' GTM-AB12CD '],
                    'script_host' => ['value' => ' SGTM.Example.com '],
                ],
            ],
        ]);

        self::assertSame('GTM-AB12CD', $this->stored('gtm/container_id'));
        self::assertSame('sgtm.example.com', $this->stored('gtm/script_host'));
    }

    /**
     * A value that is not a container id is refused
     *
     * @return void
     */
    public function testInvalidContainerIdIsRefused(): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('Use the format GTM- followed by letters and digits');

        $this->save(['gtm' => ['fields' => ['container_id' => ['value' => '<script>GTM-1</script>']]]]);
    }

    /**
     * A URL, a host with a path, or a name without a domain is refused as the script host
     *
     * @dataProvider invalidHosts
     * @param string $host
     * @return void
     */
    #[DataProvider('invalidHosts')]
    public function testInvalidScriptHostIsRefused(string $host): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('Enter the host name only');

        $this->save(['gtm' => ['fields' => ['script_host' => ['value' => $host]]]]);
    }

    /**
     * Values that are not a host name alone
     *
     * @return array<string, array{string}>
     */
    public static function invalidHosts(): array
    {
        return [
            'URL' => ['https://www.googletagmanager.com'],
            'host with a path' => ['www.googletagmanager.com/gtm.js'],
            'name without a domain' => ['localhost'],
        ];
    }

    /**
     * The gtag and Google Ads ids are stored trimmed and in capitals, the label and the fixed value trimmed
     *
     * @return void
     */
    public function testValidGtagAndAdsSettingsAreNormalised(): void
    {
        $this->save([
            'gtag' => ['fields' => ['measurement_id' => ['value' => ' g-ab12cd34 ']]],
            'ads' => [
                'fields' => [
                    'enabled' => ['value' => '1'],
                    'conversion_id' => ['value' => ' aw-1234567 '],
                    'conversion_label' => ['value' => ' QgmJ_Lu-9 '],
                    'value_source' => ['value' => 'fixed'],
                    'fixed_value' => ['value' => ' 12.50 '],
                ],
            ],
        ]);

        self::assertSame('G-AB12CD34', $this->stored('gtag/measurement_id'));
        self::assertSame('AW-1234567', $this->stored('ads/conversion_id'));
        self::assertSame('QgmJ_Lu-9', $this->stored('ads/conversion_label'));
        self::assertSame('fixed', $this->stored('ads/value_source'));
        self::assertSame('12.50', $this->stored('ads/fixed_value'));
    }

    /**
     * A value the tags could not use is refused with a message naming what it should look like
     *
     * @dataProvider invalidGtagAndAdsSettings
     * @param string $group
     * @param string $field
     * @param string $value
     * @param string $message
     * @return void
     */
    #[DataProvider('invalidGtagAndAdsSettings')]
    public function testInvalidGtagAndAdsSettingsAreRefused(
        string $group,
        string $field,
        string $value,
        string $message
    ): void {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage($message);

        $this->save([$group => ['fields' => [$field => ['value' => $value]]]]);
    }

    /**
     * Values the tags could not use
     *
     * @return array<string, array{string, string, string, string}>
     */
    public static function invalidGtagAndAdsSettings(): array
    {
        return [
            'Universal Analytics id' => ['gtag', 'measurement_id', 'UA-1234-1', 'Use the format G-'],
            'bare conversion number' => ['ads', 'conversion_id', '1234567', 'Use the format AW-'],
            'label with a slash' => ['ads', 'conversion_label', 'abc/def', 'underscores and hyphens only'],
            'negative value' => ['ads', 'fixed_value', '-5', 'amount of zero or more'],
            'text value' => ['ads', 'fixed_value', 'ten', 'amount of zero or more'],
        ];
    }

    /**
     * The two tax bases and the checkout step value are separate fields, saved as posted; the checkout step value
     * offers the items' value first, then the cart's grand total
     *
     * @magentoAppIsolation enabled
     * @return void
     */
    public function testTaxBasesAndCheckoutStepValueAreSaved(): void
    {
        $form = $this->settingsForm(self::SECTION)->getForm();
        $fields = ['item_catalogue_price_includes_tax', 'item_line_price_includes_tax', 'checkout_step_value_basis'];
        foreach ($fields as $id) {
            self::assertNotNull($form->getElement(self::SECTION . '_' . $id), $id);
        }
        self::assertNull($form->getElement(self::SECTION . '_item_price_includes_tax'));
        $this->signOut();

        $this->save([
            'item' => [
                'fields' => [
                    'catalogue_price_includes_tax' => ['value' => '1'],
                    'line_price_includes_tax' => ['value' => '0'],
                ],
            ],
            'checkout' => ['fields' => ['step_value_basis' => ['value' => 'grand_total']]],
        ]);

        self::assertSame('1', $this->stored('item/catalogue_price_includes_tax'));
        self::assertSame('0', $this->stored('item/line_price_includes_tax'));
        self::assertSame('grand_total', $this->stored('checkout/step_value_basis'));
        self::assertSame(
            ['items', 'grand_total'],
            $this->values($this->service(CheckoutStepValueBasisOptions::class))
        );
    }

    /**
     * The attribute lists offer the product id and text-like attributes as identifiers, and no brand first
     *
     * @return void
     */
    public function testAttributeListsOfferTheRightAttributes(): void
    {
        $identifiers = $this->service(OptionSourceInterface::class, 'HryvinskyiDataLayerIdentifierAttributes');
        $brands = $this->service(OptionSourceInterface::class, 'HryvinskyiDataLayerBrandAttributes');

        $identifierCodes = $this->values($identifiers);
        self::assertSame('entity_id', $identifierCodes[0] ?? null);
        self::assertContains('sku', $identifierCodes);
        self::assertContains('name', $identifierCodes);
        self::assertNotContains('price', $identifierCodes);

        $brandCodes = $this->values($brands);
        self::assertSame('', $brandCodes[0] ?? null);
        self::assertContains('manufacturer', $brandCodes);
        self::assertNotContains('sku', $brandCodes);
    }

    /**
     * Get the values of a source's options, in order
     *
     * @param OptionSourceInterface $source
     * @return list<mixed>
     */
    private function values(OptionSourceInterface $source): array
    {
        $values = [];
        foreach ($source->toOptionArray() as $option) {
            $values[] = is_array($option) ? $option['value'] ?? null : null;
        }

        return $values;
    }

    /**
     * Save groups of the section at default scope, the way the admin form posts them
     *
     * @param array<string, mixed> $groups
     * @return void
     */
    private function save(array $groups): void
    {
        $this->service(ConfigFactory::class)->create(
            ['data' => ['section' => self::SECTION, 'website' => null, 'store' => null, 'groups' => $groups]]
        )->save();
    }

    /**
     * Read a setting of the section as stored at default scope
     *
     * @param string $path The path below the section
     * @return string|null Null when no row is stored
     */
    private function stored(string $path): ?string
    {
        $collection = $this->service(CollectionFactory::class)->create();
        $collection->addFieldToFilter('path', self::SECTION . '/' . $path)
            ->addFieldToFilter('scope', 'default')
            ->addFieldToFilter('scope_id', '0');
        $row = $collection->getFirstItem();
        $value = $row->getData('value');

        return $row->getId() === null ? null : (is_scalar($value) ? (string) $value : '');
    }
}
