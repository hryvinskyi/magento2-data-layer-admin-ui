<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\TestFramework\TestCase\AbstractBackendController;

/**
 * The settings section takes its look from the shared admin UI kit: the page links the kit's stylesheet before the
 * module's own, and the module's own markup, and only that, carries the kit's token root
 *
 * The form around the module's rows (the row, its cells, the labels and the inherit checkboxes) is Magento's and keeps
 * the admin theme, so no row is a kit root that restyles it; the kit's tokens are declared on the module's markup
 * alone.
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SettingsLookTest extends AbstractBackendController
{
    use RendersSettingsForm;

    private const SECTION = 'hryvinskyi_datalayer';
    private const TABLE_ID = 'hryvinskyi_datalayer_events_disabled';
    private const LOADER_STATUS = 'hryvinskyi_datalayer_gtm_loader_status';
    private const DOUBLE_COUNT = 'hryvinskyi_datalayer_gtag_double_count_warning';
    private const TOKEN_ROOT = 'contains(concat(" ", normalize-space(@class), " "), " hui-tokens ")';
    private const KIT_ROOT = 'contains(concat(" ", normalize-space(@class), " "), " hui ")';

    /**
     * @var string
     */
    protected $resource = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $uri = 'backend/admin/system_config/edit/section/hryvinskyi_datalayer';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_GET;

    /**
     * The configuration page sends an administrator without access to the section back to the settings index
     *
     * @var int
     */
    protected $expectedNoAccessResponseCode = 302;

    /**
     * The section's page links the kit's stylesheet, and links it before the module's own: the module's rules read
     * the kit's tokens and override the kit's parts of the same weight by that order alone
     *
     * @return void
     */
    public function testLinksTheKitStylesheetBeforeTheModulesOwn(): void
    {
        $this->dispatch($this->uri);
        $response = $this->getResponse();
        self::assertInstanceOf(HttpResponse::class, $response);
        self::assertSame(200, $response->getHttpResponseCode());

        $hrefs = array_map(
            static fn (\DOMElement $link): string => $link->getAttribute('href'),
            $this->elements($this->page($response->getBody()), '//head/link[@rel="stylesheet"]')
        );
        $kit = $this->position($hrefs, '/Hryvinskyi_AdminUi/css/admin-ui.css');
        $own = $this->position($hrefs, '/Hryvinskyi_DataLayerAdminUi/css/config-fields.css');

        self::assertLessThan($own, $kit, 'the kit stylesheet is linked before the settings rows\'');
    }

    /**
     * The events table is a token root, and nothing in it is a full kit root
     *
     * @return void
     */
    public function testEventsTableIsATokenRoot(): void
    {
        $xpath = $this->parsed($this->rowHtml($this->settingsForm(self::SECTION), self::TABLE_ID));

        $roots = $this->elements($xpath, '//*[@data-hryvinskyi-datalayer-events-table]');
        self::assertCount(1, $roots);
        self::assertCount(1, $this->elements($xpath, '//*[' . self::TOKEN_ROOT . ']'));
        self::assertCount(
            1,
            $this->elements($xpath, '//*[@data-hryvinskyi-datalayer-events-table][' . self::TOKEN_ROOT . ']')
        );
        self::assertSame([], $this->elements($xpath, '//*[' . self::KIT_ROOT . ']'));
    }

    /**
     * The source and fixed-channel labels of the events table are the kit's badges
     *
     * @return void
     */
    public function testEventsTableLabelsAreKitBadges(): void
    {
        $xpath = $this->parsed($this->rowHtml($this->settingsForm(self::SECTION), self::TABLE_ID));

        $badges = $this->elements($xpath, '//span[contains(@class, "hryvinskyi-datalayer-events__badge")]');
        self::assertNotSame([], $badges);
        foreach ($badges as $badge) {
            self::assertContains('hui-badge', $this->classesOf($badge));
        }
        $fixed = $this->elements($xpath, '//span[contains(@class, "hryvinskyi-datalayer-events__fixed")]');
        self::assertNotSame([], $fixed);
        foreach ($fixed as $label) {
            self::assertContains('hui-badge', $this->classesOf($label));
            self::assertContains('hui-badge--fixed', $this->classesOf($label));
        }
    }

    /**
     * A status line is a token root; the form's note after it is not
     *
     * @return void
     */
    public function testStatusLineIsATokenRoot(): void
    {
        $xpath = $this->parsed($this->rowHtml($this->settingsForm(self::SECTION), self::LOADER_STATUS));

        $status = $this->elements($xpath, '//*[@data-role="status"]');
        self::assertCount(1, $status);
        self::assertContains('hui-tokens', $this->classesOf($status[0]));
        $note = 'contains(concat(" ", normalize-space(@class), " "), " note ")';
        self::assertNotSame([], $this->elements($xpath, '//*[' . $note . ']'), 'The row prints the form note');
        self::assertSame([], $this->elements($xpath, '//*[' . $note . '][' . self::TOKEN_ROOT . ']'));
        self::assertSame([], $this->elements($xpath, '//*[' . self::KIT_ROOT . ']'));
    }

    /**
     * A full-width notice sits in a token root of its own, inside the table cell, which stays the admin's
     *
     * @return void
     */
    public function testNoticeRowIsWrappedInATokenRoot(): void
    {
        $this->saveSettings(self::SECTION, [
            'general' => ['fields' => ['enabled' => ['value' => '1']]],
            'gtm' => ['fields' => ['container_id' => ['value' => 'GTM-AB12CD']]],
            'gtag' => ['fields' => ['measurement_id' => ['value' => 'G-AB12CD34']]],
        ]);
        $html = $this->rowHtml($this->settingsForm(self::SECTION), self::DOUBLE_COUNT);

        self::assertStringStartsWith(
            '<tr id="row_' . self::DOUBLE_COUNT . '"><td colspan="4"><div class="hui-tokens"><div id="'
            . self::DOUBLE_COUNT . '" class="hryvinskyi-datalayer-notice" role="note">',
            $html
        );
        self::assertStringEndsWith('</div></div></td></tr>', $html);
        $xpath = $this->parsed($html);
        self::assertCount(1, $this->elements($xpath, '//*[' . self::TOKEN_ROOT . ']'));
        self::assertSame([], $this->elements($xpath, '//*[' . self::KIT_ROOT . ']'));
    }

    /**
     * Parse a whole page the way a browser builds its document
     *
     * @param string $html
     * @return \DOMXPath
     */
    private function page(string $html): \DOMXPath
    {
        $document = new \DOMDocument();
        $errors = libxml_use_internal_errors(true);
        $document->loadHTML($html);
        libxml_clear_errors();
        libxml_use_internal_errors($errors);

        return new \DOMXPath($document);
    }

    /**
     * Read the classes an element carries
     *
     * @param \DOMElement $element
     * @return list<string>
     */
    private function classesOf(\DOMElement $element): array
    {
        return array_values(array_filter(preg_split('/\s+/', trim($element->getAttribute('class'))) ?: []));
    }

    /**
     * Find where the first address that holds a path stands in a list of addresses
     *
     * @param list<string> $hrefs
     * @param string $path
     * @return int
     */
    private function position(array $hrefs, string $path): int
    {
        foreach ($hrefs as $index => $href) {
            if (str_contains($href, $path)) {
                return $index;
            }
        }

        self::fail(sprintf('No stylesheet at %s is linked; the head links: %s', $path, implode(', ', $hrefs)));
    }
}
