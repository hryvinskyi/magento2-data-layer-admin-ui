<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use PHPUnit\Framework\TestCase;

/**
 * The read-only rows of the section render the scope's saved settings: the loader status line (the dot and the status
 * on one line, the preview link under it) and the warning that GA4 may count events twice
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 * @magentoAppIsolation enabled
 */
class StatusRenderersTest extends TestCase
{
    use RendersSettingsForm;

    private const SECTION = 'hryvinskyi_datalayer';
    private const LOADER_STATUS = 'hryvinskyi_datalayer_gtm_loader_status';
    private const DOUBLE_COUNT = 'hryvinskyi_datalayer_gtag_double_count_warning';

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        $this->signOut();
    }

    /**
     * With the data layer off the loader is not output, whatever the container id
     *
     * @return void
     */
    public function testLoaderStatusWhenDisabled(): void
    {
        $this->saveLoader('0', 'GTM-AB12CD', '');
        $html = $this->rowHtml($this->settingsForm(self::SECTION), self::LOADER_STATUS);

        self::assertStringContainsString('hryvinskyi-datalayer-status--muted', $html);
        self::assertStringContainsString('Not output: the module is disabled at this scope.', $html);
        self::assertStringNotContainsString('tagassistant.google.com', $html);
        self::assertStringNotContainsString('_inherit', $html);
    }

    /**
     * With the data layer on and no container id the loader is not output
     *
     * @return void
     */
    public function testLoaderStatusWithoutContainer(): void
    {
        $this->saveLoader('1', '', '');
        $html = $this->rowHtml($this->settingsForm(self::SECTION), self::LOADER_STATUS);

        self::assertStringContainsString('hryvinskyi-datalayer-status--attention', $html);
        self::assertStringContainsString('Not output: Container ID is empty.', $html);
    }

    /**
     * With a container id the line shows the script's address at the website, from its own host, and links to Tag
     * Assistant
     *
     * @return void
     */
    public function testLoaderStatusWhenOutputAtWebsite(): void
    {
        $this->saveLoader('1', 'GTM-AB12CD', '');
        $websiteId = $this->mainWebsiteId();
        $this->saveSettings(
            self::SECTION,
            ['gtm' => ['fields' => ['script_host' => ['value' => 'gtm.example.com']]]],
            $websiteId
        );
        $html = $this->rowHtml($this->settingsForm(self::SECTION, $websiteId), self::LOADER_STATUS);

        self::assertStringContainsString('hryvinskyi-datalayer-status--ok', $html);
        self::assertStringNotContainsString('_inherit', $html);
        $xpath = $this->parsed($html);
        $status = $this->elements($xpath, '//*[@id="' . self::LOADER_STATUS . '"][@data-role="status"]');
        self::assertCount(1, $status);
        $line = $this->elements($xpath, './div[contains(@class, "hryvinskyi-datalayer-status__line")]', $status[0]);
        self::assertCount(1, $line, 'The dot and the status share one line.');
        self::assertCount(
            1,
            $this->elements($xpath, './span[contains(@class, "hryvinskyi-datalayer-status__dot")]', $line[0])
        );
        $text = $this->elements(
            $xpath,
            './span[contains(@class, "hryvinskyi-datalayer-status__text--code")]',
            $line[0]
        );
        self::assertCount(1, $text);
        self::assertSame('Loader: https://gtm.example.com/gtm.js?id=GTM-AB12CD', $this->textOf($text[0]));
        $link = $this->elements($xpath, './a[contains(@class, "hryvinskyi-datalayer-status__link")]', $status[0]);
        self::assertCount(1, $link, 'The preview link sits under the line.');
        self::assertSame('https://tagassistant.google.com/', $link[0]->getAttribute('href'));
        self::assertSame('_blank', $link[0]->getAttribute('target'));
        self::assertSame('noopener noreferrer', $link[0]->getAttribute('rel'));
        self::assertSame('Open GTM Preview ↗', $this->textOf($link[0]));
    }

    /**
     * The double-count warning shows only while both a container id and a measurement id are set
     *
     * @return void
     */
    public function testDoubleCountWarningNeedsBothIds(): void
    {
        $this->saveLoader('1', 'GTM-AB12CD', '');
        self::assertSame('', $this->rowHtml($this->settingsForm(self::SECTION), self::DOUBLE_COUNT));

        $this->saveSettings(self::SECTION, ['gtag' => ['fields' => ['measurement_id' => ['value' => 'G-AB12CD34']]]]);
        $html = $this->rowHtml($this->settingsForm(self::SECTION), self::DOUBLE_COUNT);

        self::assertStringContainsString('<tr id="row_' . self::DOUBLE_COUNT . '"><td colspan="4">', $html);
        $xpath = $this->parsed($html);
        $notice = $this->elements($xpath, '//*[@id="' . self::DOUBLE_COUNT . '"][@role="note"]');
        self::assertCount(1, $notice);
        self::assertStringContainsString('hryvinskyi-datalayer-notice', $notice[0]->getAttribute('class'));
        self::assertCount(
            1,
            $this->elements($xpath, './span[@aria-hidden="true"][contains(@class, "__icon")]', $notice[0])
        );
        self::assertStringContainsString('GA4 counts every event twice', $this->textOf($notice[0]));
    }

    /**
     * Save the loader settings at the default scope
     *
     * @param string $enabled
     * @param string $containerId
     * @param string $host
     * @return void
     */
    private function saveLoader(string $enabled, string $containerId, string $host): void
    {
        $this->saveSettings(self::SECTION, [
            'general' => ['fields' => ['enabled' => ['value' => $enabled]]],
            'gtm' => ['fields' => [
                'container_id' => ['value' => $containerId],
                'script_host' => ['value' => $host],
            ]],
        ]);
    }
}
