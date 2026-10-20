<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayerAdminUi\Test\Integration\RendersSettingsForm;
use Magento\Backend\Model\UrlInterface;
use Magento\Config\Block\System\Config\Form;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\RequestInterface;
use Magento\Store\Model\StoreManagerInterface;
use PHPUnit\Framework\TestCase;

/**
 * The settings section starts with a link that opens the setup wizard at the scope the section shows
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 * @magentoAppIsolation enabled
 */
class SetupWizardLinkTest extends TestCase
{
    use RendersSettingsForm;

    private const SECTION = 'hryvinskyi_datalayer';
    private const ROW = 'hryvinskyi_datalayer_general_wizard_link';

    /**
     * Render without the per-session key, so the addresses compare as written
     *
     * @inheritDoc
     */
    protected function setUp(): void
    {
        $this->service(UrlInterface::class)->turnOffSecretKey();
    }

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        $this->service(UrlInterface::class)->turnOnSecretKey();
        $this->signOut();
    }

    /**
     * At the default scope the link opens the wizard with no scope
     *
     * @return void
     */
    public function testLinkAtTheDefaultScope(): void
    {
        $href = $this->linkAddress($this->settingsForm(self::SECTION));

        self::assertStringContainsString('/hryvinskyi_datalayer/setup/index/', $href);
        self::assertStringNotContainsString('/website/', $href);
        self::assertStringNotContainsString('/store/', $href);
    }

    /**
     * At a website the link carries the website
     *
     * @return void
     */
    public function testLinkAtAWebsite(): void
    {
        $websiteId = $this->mainWebsiteId();

        $href = $this->linkAddress($this->settingsForm(self::SECTION, $websiteId));

        self::assertStringContainsString('/hryvinskyi_datalayer/setup/index/website/' . $websiteId . '/', $href);
    }

    /**
     * At a store view the link carries the store view
     *
     * @return void
     */
    public function testLinkAtAStoreView(): void
    {
        $store = $this->service(StoreManagerInterface::class)->getDefaultStoreView();
        self::assertNotNull($store);
        $form = $this->settingsForm(self::SECTION);
        $this->service(HttpRequest::class, RequestInterface::class)->setParam('store', (string) $store->getId());

        $href = $this->linkAddress($form);

        self::assertStringContainsString('/hryvinskyi_datalayer/setup/index/store/' . $store->getId() . '/', $href);
    }

    /**
     * Render the link row and read the address of its one link
     *
     * @param Form $form
     * @return string
     */
    private function linkAddress(Form $form): string
    {
        $xpath = $this->parsed($this->rowHtml($form, self::ROW));
        $links = $this->elements($xpath, '//a[@data-role="setup-wizard-link"]');
        self::assertCount(1, $links);
        self::assertSame('Open setup wizard', $this->textOf($links[0]));

        return $links[0]->getAttribute('href');
    }
}
