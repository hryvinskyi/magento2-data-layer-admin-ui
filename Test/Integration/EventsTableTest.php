<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration;

use Magento\Framework\Exception\LocalizedException;
use PHPUnit\Framework\TestCase;

/**
 * The events table renders every known event with its Send switch and channel, posts the two settings it owns under
 * their own names, and what it posts is saved at the scope being edited
 *
 * @magentoAppArea adminhtml
 * @magentoDbIsolation enabled
 * @magentoAppIsolation enabled
 */
class EventsTableTest extends TestCase
{
    use RendersSettingsForm;

    private const SECTION = 'hryvinskyi_datalayer';
    private const DISABLED = 'hryvinskyi_datalayer/events/disabled';
    private const ROUTING = 'hryvinskyi_datalayer/channels/routing';
    private const TABLE_ID = 'hryvinskyi_datalayer_events_disabled';

    /**
     * @inheritDoc
     */
    protected function tearDown(): void
    {
        $this->signOut();
    }

    /**
     * Saving the table's input at a website stores the events switched off as a comma list and the routing rows as
     * a JSON list, at that website only
     *
     * @return void
     */
    public function testTableInputIsSavedAtWebsiteScope(): void
    {
        $websiteId = $this->mainWebsiteId();
        $this->saveSettings(self::SECTION, $this->tableInput('view_promotion,sign_up', [
            ['event' => 'purchase', 'channel' => 'server'],
            ['event' => 'add_to_cart', 'channel' => 'both'],
        ]), $websiteId);

        self::assertSame('view_promotion,sign_up', $this->storedSetting(self::DISABLED, $websiteId));
        self::assertSame(
            '[{"event":"purchase","channel":"server"},{"event":"add_to_cart","channel":"both"}]',
            $this->storedSetting(self::ROUTING, $websiteId)
        );
        self::assertNull($this->storedSetting(self::DISABLED));
        self::assertNull($this->storedSetting(self::ROUTING));
    }

    /**
     * An empty table input stores an empty list over the previous one, and "use the parent scope's value" removes
     * both settings from the website
     *
     * @return void
     */
    public function testEmptyInputAndInheritance(): void
    {
        $websiteId = $this->mainWebsiteId();
        $this->saveSettings(
            self::SECTION,
            $this->tableInput('login', [['event' => 'purchase', 'channel' => 'server']]),
            $websiteId
        );
        $this->saveSettings(self::SECTION, $this->tableInput('', []), $websiteId);

        self::assertSame('', $this->storedSetting(self::DISABLED, $websiteId));
        self::assertSame('[]', $this->storedSetting(self::ROUTING, $websiteId));

        $this->saveSettings(self::SECTION, ['events' => ['fields' => [
            'disabled' => ['inherit' => '1'],
            'routing' => ['inherit' => '1'],
        ]]], $websiteId);

        self::assertNull($this->storedSetting(self::DISABLED, $websiteId));
        self::assertNull($this->storedSetting(self::ROUTING, $websiteId));
    }

    /**
     * A posted value no event could use is refused
     *
     * @return void
     */
    public function testUnusableInputIsRefused(): void
    {
        $this->expectException(LocalizedException::class);
        $this->expectExceptionMessage('is not a channel');

        $this->saveSettings(self::SECTION, $this->tableInput('', [['event' => 'purchase', 'channel' => 'cloud']]));
    }

    /**
     * At the default scope the table lists every known event with its stored state; a fixed channel shows as a badge,
     * every other event as a channel select; nothing is inherited there
     *
     * @return void
     */
    public function testTableRendersEveryKnownEventAtDefaultScope(): void
    {
        $this->saveSettings(self::SECTION, $this->tableInput('view_promotion', [
            ['event' => 'purchase', 'channel' => 'server'],
        ]));
        $html = $this->decoded($this->rowHtml($this->settingsForm(self::SECTION), self::TABLE_ID));
        $config = $this->config($html);

        self::assertStringContainsString('<tr id="row_' . self::TABLE_ID . '"><td colspan="4">', $html);
        $xpath = $this->parsed($html);
        foreach (['view_item_list', 'view_item', 'add_to_cart', 'purchase', 'ads_conversion', 'sign_up'] as $event) {
            self::assertCount(
                1,
                $this->elements($xpath, '//*[@data-role="event"][@data-event="' . $event . '"]'),
                $event
            );
        }
        self::assertStringContainsString('Product page viewed', $html);
        self::assertSame(
            ['Page', 'Detected in the shopper\'s browser'],
            $this->sourceBadge($html, 'view_item'),
            'A page event detected by the browser'
        );
        self::assertSame(
            ['Server', 'Detected by the store, never posted by a browser'],
            $this->sourceBadge($html, 'add_to_cart'),
            'A cart event detected by the server'
        );
        self::assertSame(
            ['Order', 'Detected by the store, never posted by a browser'],
            $this->sourceBadge($html, 'purchase'),
            'An order event'
        );
        self::assertStringContainsString('Browser · fixed', $html);
        self::assertStringContainsString('Server · fixed', $html);
        self::assertStringNotContainsString('data-role="inherit"', $html);
        self::assertMatchesRegularExpression(
            '#name="groups\[events\]\[fields\]\[disabled\]\[value\]"\s+value="view_promotion"\s+/>#',
            $html
        );
        self::assertStringContainsString('name="groups[events][fields][routing][value][_0][channel]"', $html);
        self::assertMatchesRegularExpression(
            '#<script type="importmap"[^>]*>\{"imports":\{[^<]*data-layer-admin\\\\/events-table\\\\/widget\.js[^<]*'
            . '</script><script[^>]*type="module"[^>]*src="[^"]*/Hryvinskyi_DataLayerAdminUi/js/events-table/'
            . 'main\.js"#',
            $html
        );

        $rows = [];
        foreach ($config['rows'] as $row) {
            $rows[$row['event']] = $row;
        }
        self::assertSame(
            ['event' => 'purchase', 'send' => true, 'channel' => 'server', 'fixed' => false],
            $rows['purchase']
        );
        self::assertSame(
            ['event' => 'view_promotion', 'send' => false, 'channel' => 'browser', 'fixed' => false],
            $rows['view_promotion']
        );
        self::assertSame(
            ['event' => 'ads_conversion', 'send' => true, 'channel' => 'browser', 'fixed' => true],
            $rows['ads_conversion']
        );
        self::assertSame(
            [
                'disabled' => 'groups[events][fields][disabled][value]',
                'disabledInherit' => 'groups[events][fields][disabled][inherit]',
                'routing' => 'groups[events][fields][routing][value]',
                'routingInherit' => 'groups[events][fields][routing][inherit]',
            ],
            $config['names']
        );
    }

    /**
     * The table is a grid of rows carrying the table roles, not a table of the settings form: a header row of five
     * column headers, a labelled group per kind of event, and per event one row of five cells. Each Send switch is a
     * native checkbox inside its label, drawn by a separate track beside it
     *
     * @return void
     */
    public function testTableIsAnAccessibleGridOfItsOwn(): void
    {
        $xpath = $this->parsed($this->rowHtml($this->settingsForm(self::SECTION), self::TABLE_ID));
        $roots = $this->elements($xpath, '//*[@data-hryvinskyi-datalayer-events-table]');
        self::assertCount(1, $roots);
        $root = $roots[0];

        self::assertSame([], $this->elements($xpath, './/table | .//tr | .//td | .//th', $root));
        $tables = $this->elements($xpath, './/*[@role="table"]', $root);
        self::assertCount(1, $tables);
        $label = $this->elements($xpath, '//*[@id="' . $tables[0]->getAttribute('aria-labelledby') . '"]');
        self::assertCount(1, $label);
        self::assertSame('Events sent to GA4', $this->textOf($label[0]));

        $headers = $this->elements(
            $xpath,
            './*[@role="rowgroup"][1]/*[@role="row"]/*[@role="columnheader"]',
            $tables[0]
        );
        self::assertSame(
            ['Event', 'What triggers it', 'Where it comes from', 'Send', 'Channel'],
            array_map(fn (\DOMElement $header): string => $this->textOf($header), $headers)
        );
        $groups = $this->elements($xpath, './*[@role="rowgroup"][position() > 1]', $tables[0]);
        self::assertNotSame([], $groups);
        foreach ($groups as $group) {
            $label = $this->elements($xpath, './*[@role="row"]/*[@role="rowheader"][@aria-colspan="5"]', $group);
            self::assertCount(1, $label);
            self::assertNotSame('', $this->textOf($label[0]));
        }

        $rows = $this->elements($xpath, './/*[@data-role="event"]', $tables[0]);
        self::assertGreaterThan(10, count($rows));
        foreach ($rows as $row) {
            $event = $row->getAttribute('data-event');
            self::assertSame('row', $row->getAttribute('role'), $event);
            self::assertCount(5, $this->elements($xpath, './*[@role="cell"]', $row), $event);
            $switch = $this->elements($xpath, './/label[contains(@class, "hryvinskyi-datalayer-switch")]', $row);
            self::assertCount(1, $switch, $event);
            $input = $this->elements(
                $xpath,
                './input[@type="checkbox"][@role="switch"][@data-role="send"]',
                $switch[0]
            );
            self::assertCount(1, $input, $event);
            self::assertSame('Send ' . $event, $input[0]->getAttribute('aria-label'));
            self::assertStringContainsString('hryvinskyi-datalayer-switch__input', $input[0]->getAttribute('class'));
            $track = $this->elements(
                $xpath,
                './following-sibling::span[1][contains(@class, "hryvinskyi-datalayer-switch__track")]'
                . '[@aria-hidden="true"]/span[contains(@class, "hryvinskyi-datalayer-switch__knob")]',
                $input[0]
            );
            self::assertCount(1, $track, $event);
            self::assertCount(1, $this->elements($xpath, './span[@data-role="send-text"]', $switch[0]), $event);
        }
    }

    /**
     * At a website without values of its own the table shows the inherited state, greyed, with its one checkbox
     * ticked, and posts nothing but the two "inherit" inputs
     *
     * @return void
     */
    public function testInheritedTableAtWebsiteScope(): void
    {
        $this->saveSettings(self::SECTION, $this->tableInput('login', []));
        $html = $this->decoded(
            $this->rowHtml($this->settingsForm(self::SECTION, $this->mainWebsiteId()), self::TABLE_ID)
        );

        self::assertStringContainsString('is-inherited', $html);
        self::assertMatchesRegularExpression(
            '#<input type="checkbox" value="1" data-role="inherit"\s+name="groups\[events\]\[fields\]\[disabled\]'
            . '\[inherit\]"\s+checked="checked"#',
            $html
        );
        self::assertMatchesRegularExpression(
            '#name="groups\[events\]\[fields\]\[routing\]\[inherit\]"\s+/>#',
            $html
        );
        self::assertMatchesRegularExpression(
            '#name="groups\[events\]\[fields\]\[disabled\]\[value\]"\s+value="login"\s+disabled="disabled"#',
            $html
        );
    }

    /**
     * A website whose routing rows are its own shows the checkbox unticked, even when its disabled events are
     * inherited: the one checkbox covers both settings
     *
     * @return void
     */
    public function testOneOwnSettingUnticksTheCheckbox(): void
    {
        $websiteId = $this->mainWebsiteId();
        $this->saveSettings(self::SECTION, ['events' => ['fields' => [
            'routing' => ['value' => ['_1' => ['event' => 'purchase', 'channel' => 'server']]],
        ]]], $websiteId);
        $html = $this->decoded($this->rowHtml($this->settingsForm(self::SECTION, $websiteId), self::TABLE_ID));

        self::assertDoesNotMatchRegularExpression('#data-role="inherit"\s+name="[^"]+"\s+checked#', $html);
        self::assertStringNotContainsString('is-inherited', $html);
    }

    /**
     * Decode the character references the escaper writes in attributes, so names read as the browser posts them
     *
     * @param string $html
     * @return string
     */
    private function decoded(string $html): string
    {
        return html_entity_decode($html, ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    /**
     * Read the source badge of an event's row: its text and its title
     *
     * @param string $html The rendered table
     * @param string $event
     * @return array{string, string}
     */
    private function sourceBadge(string $html, string $event): array
    {
        $xpath = $this->parsed($html);
        $badges = $this->elements(
            $xpath,
            '//*[@data-role="event"][@data-event="' . $event . '"]'
            . '//span[contains(@class, "hryvinskyi-datalayer-events__badge")]'
        );
        self::assertCount(1, $badges, $event);

        return [$this->textOf($badges[0]), $badges[0]->getAttribute('title')];
    }

    /**
     * The table's configuration as the page prints it
     *
     * @param string $html
     * @return array{rows: list<array{event: string, send: bool, channel: string, fixed: bool}>,
     *     names: array<string, string>, serverDeliveryEnabled: bool}
     */
    private function config(string $html): array
    {
        self::assertSame(
            1,
            preg_match('#<script type="application/json"\s+data-role="config">(.*?)</script>#s', $html, $match)
        );
        $config = json_decode($match[1], true, 512, JSON_THROW_ON_ERROR);
        self::assertIsArray($config);
        self::assertIsArray($config['rows'] ?? null);
        self::assertIsArray($config['names'] ?? null);
        self::assertIsBool($config['serverDeliveryEnabled'] ?? null);

        /** @var array{rows: list<array{event: string, send: bool, channel: string, fixed: bool}>,
         *     names: array<string, string>, serverDeliveryEnabled: bool} $config */
        return $config;
    }

    /**
     * What the events table posts for a state
     *
     * @param string $disabled
     * @param list<array{event: string, channel: string}> $routing
     * @return array<string, mixed>
     */
    private function tableInput(string $disabled, array $routing): array
    {
        $rows = ['__empty' => ''];
        foreach ($routing as $index => $row) {
            $rows['_' . $index] = $row;
        }

        return ['events' => ['fields' => [
            'disabled' => ['value' => $disabled],
            'routing' => ['value' => $rows],
        ]]];
    }
}
