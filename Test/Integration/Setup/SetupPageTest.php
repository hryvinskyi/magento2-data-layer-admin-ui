<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Laminas\Http\Header\HeaderInterface;
use Magento\Backend\Model\Menu\Config as MenuConfig;
use Magento\Backend\Model\Menu\Item;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Store\Model\StoreManagerInterface;
use Magento\TestFramework\TestCase\AbstractBackendController;

/**
 * The setup wizard's page, rendered by the real admin for a signed-in administrator: the menu item leads to it, the
 * settings' access rule guards it, and it prints the wizard's root, its loading line, a page configuration the browser
 * code can read, the import map and the entry module
 *
 * The configuration is checked the way the browser's parser reads it: every endpoint an address, an address to leave
 * to for every scope, a form key and a locale, wording as text keyed by text, plugins with unique ids, an initial scope
 * among the scopes, and objects where the parser wants objects.
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SetupPageTest extends AbstractBackendController
{
    use ResolvesServices;

    /**
     * @var string
     */
    protected $resource = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $uri = 'backend/hryvinskyi_datalayer/setup/index';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_GET;

    /**
     * The page holds the root with its failure text and loading line, the configuration inside it, then the import
     * map of the shared modules and the wizard's entry module
     *
     * @return void
     */
    public function testRendersTheWizardsMountPoint(): void
    {
        $xpath = $this->page();

        $roots = $this->elements($xpath, '//div[@data-role="hdl-setup"]');
        self::assertCount(1, $roots);
        self::assertStringContainsString('hdl-setup', $roots[0]->getAttribute('class'));
        self::assertNotSame('', trim($roots[0]->getAttribute('data-failed-text')));
        $loading = $this->elements($xpath, '//div[@data-role="hdl-setup"]//*[@data-role="hdl-setup-loading"]');
        self::assertCount(1, $loading);
        self::assertNotSame('', trim($loading[0]->textContent));
        self::assertCount(
            1,
            $this->elements($xpath, '//div[@data-role="hdl-setup"]/script[@type="application/json"]'
                . '[@data-role="hdl-setup-config"]')
        );

        $importMaps = $this->elements($xpath, '//script[@type="importmap"]');
        self::assertNotSame([], $importMaps);
        $imports = $this->object($this->decoded($importMaps[count($importMaps) - 1]->textContent), 'importmap')
            ->imports ?? null;
        self::assertInstanceOf(\stdClass::class, $imports);
        foreach (['preact', 'preact/hooks', 'preact/jsx-runtime', '@hryvinskyi/datalayer-setup'] as $name) {
            self::assertIsString($imports->{$name} ?? null, $name);
            self::assertStringContainsString('/Hryvinskyi_DataLayerAdminUi/js/setup/', $imports->{$name});
        }
        $entries = $this->elements($xpath, '//script[@type="module"][contains(@src, "/js/setup/wizard")]');
        self::assertCount(1, $entries);
    }

    /**
     * The printed configuration has every field the browser's parser requires, in the shape it requires
     *
     * @return void
     */
    public function testConfigurationIsWhatTheBrowserReads(): void
    {
        $config = $this->config($this->page());

        $state = $this->object($config->state ?? null, 'state');
        self::assertIsArray($state->scopes ?? null);
        $scopeIds = [];
        foreach ($state->scopes as $scope) {
            $scopeIds[] = $this->text($this->object($scope, 'scope')->id ?? null, 'scope id');
        }
        self::assertContains('default', $scopeIds);
        self::assertIsArray($state->settings ?? null);
        $this->object($state->events ?? null, 'events');

        $endpoints = $this->object($config->endpoints ?? null, 'endpoints');
        foreach (['save', 'preview', 'products'] as $endpoint) {
            self::assertStringContainsString(
                '/hryvinskyi_datalayer/setup/' . $endpoint,
                $this->text($endpoints->{$endpoint} ?? null, $endpoint)
            );
        }
        foreach (['advanced', 'close'] as $exit) {
            $urls = $this->object($endpoints->{$exit} ?? null, $exit);
            self::assertEqualsCanonicalizing($scopeIds, array_keys(get_object_vars($urls)), $exit);
            foreach ($scopeIds as $scopeId) {
                self::assertStringContainsString(
                    '/section/hryvinskyi_datalayer/',
                    $this->text($urls->{$scopeId} ?? null, $exit . ' ' . $scopeId)
                );
            }
        }

        $this->text($config->formKey ?? null, 'formKey');
        $this->text($config->locale ?? null, 'locale');
        $phrases = get_object_vars($this->object($config->phrases ?? null, 'phrases'));
        foreach (['wizard.title', 'wizard.loading', 'wizard.failed', 'leave.confirm', 'action.save_all'] as $key) {
            self::assertArrayHasKey($key, $phrases);
        }
        foreach ($phrases as $key => $text) {
            self::assertIsString($text, (string) $key);
        }
        self::assertIsArray($config->plugins ?? null);
        $pluginIds = [];
        foreach ($config->plugins as $plugin) {
            $plugin = $this->object($plugin, 'plugin');
            $pluginIds[] = $this->text($plugin->id ?? null, 'plugin id');
            $this->text($plugin->module ?? null, 'plugin module');
        }
        self::assertSame(array_unique($pluginIds), $pluginIds);
        self::assertSame('default', $config->initialScope ?? null);
        $this->object($config->extensions ?? null, 'extensions');
    }

    /**
     * The scope the configuration page passes on is the scope the wizard opens at
     *
     * @return void
     */
    public function testOpensAtTheScopeOfTheRequest(): void
    {
        $store = $this->service(StoreManagerInterface::class)->getDefaultStoreView();
        self::assertNotNull($store);
        $request = $this->getRequest();
        self::assertInstanceOf(HttpRequest::class, $request);
        $request->setParam('store', (string) $store->getId());

        $config = $this->config($this->page());

        self::assertSame('store:' . $store->getId(), $config->initialScope ?? null);
    }

    /**
     * The admin menu has the wizard's item under the data layer's entry in Sales, for the settings' access rule, and
     * its action is the route of the page, which renders
     *
     * @return void
     */
    public function testMenuItemLeadsToThePage(): void
    {
        $this->dispatch($this->uri);
        $location = $this->response()->getHeader('Location');
        self::assertSame(
            200,
            $this->response()->getHttpResponseCode(),
            $location instanceof HeaderInterface ? $location->toString() : ''
        );
        self::assertStringContainsString('data-role="hdl-setup"', $this->response()->getBody());

        $menu = $this->service(MenuConfig::class)->getMenu();
        $item = $menu->get('Hryvinskyi_DataLayerAdminUi::setup_menu');
        self::assertInstanceOf(Item::class, $item);
        self::assertSame('Hryvinskyi_DataLayerAdminUi::config', $item->toArray()['resource'] ?? null);
        self::assertTrue($item->isAllowed());
        self::assertSame(
            ['Magento_Sales::sales', 'Hryvinskyi_DataLayerAdminUi::datalayer_menu'],
            array_map(
                static fn (Item $parent): string => (string) $parent->getId(),
                $menu->getParentItems('Hryvinskyi_DataLayerAdminUi::setup_menu')
            )
        );
        self::assertStringContainsString('/hryvinskyi_datalayer/setup/index/', (string) $item->getUrl());
    }

    /**
     * Render the page and parse it
     *
     * @return \DOMXPath
     */
    private function page(): \DOMXPath
    {
        $this->dispatch($this->uri);
        $response = $this->response();
        self::assertSame(200, $response->getHttpResponseCode());
        $document = new \DOMDocument();
        $errors = libxml_use_internal_errors(true);
        $document->loadHTML($response->getBody());
        libxml_clear_errors();
        libxml_use_internal_errors($errors);

        return new \DOMXPath($document);
    }

    /**
     * Read the page configuration the page printed
     *
     * @param \DOMXPath $xpath
     * @return \stdClass
     */
    private function config(\DOMXPath $xpath): \stdClass
    {
        $scripts = $this->elements($xpath, '//script[@data-role="hdl-setup-config"]');
        self::assertCount(1, $scripts);

        return $this->object($this->decoded($scripts[0]->textContent), 'page configuration');
    }

    /**
     * Decode JSON, objects as objects, so an empty object and an empty list stay apart as the browser sees them
     *
     * @param string $json
     * @return mixed
     */
    private function decoded(string $json): mixed
    {
        return json_decode($json, false, 512, JSON_THROW_ON_ERROR);
    }

    /**
     * Check a value is a JSON object
     *
     * @param mixed $value
     * @param string $what
     * @return \stdClass
     */
    private function object(mixed $value, string $what): \stdClass
    {
        self::assertInstanceOf(\stdClass::class, $value, $what . ' is an object');

        return $value;
    }

    /**
     * Check a value is text that is not blank
     *
     * @param mixed $value
     * @param string $what
     * @return string
     */
    private function text(mixed $value, string $what): string
    {
        self::assertIsString($value, $what);
        self::assertNotSame('', trim($value), $what);

        return $value;
    }

    /**
     * Find the elements an XPath expression selects
     *
     * @param \DOMXPath $xpath
     * @param string $expression
     * @return list<\DOMElement>
     */
    private function elements(\DOMXPath $xpath, string $expression): array
    {
        $found = [];
        $nodes = $xpath->query($expression);
        foreach ($nodes === false ? [] : $nodes as $node) {
            if ($node instanceof \DOMElement) {
                $found[] = $node;
            }
        }

        return $found;
    }

    /**
     * Get the response
     *
     * @return HttpResponse
     */
    private function response(): HttpResponse
    {
        $response = $this->getResponse();
        self::assertInstanceOf(HttpResponse::class, $response);

        return $response;
    }
}
