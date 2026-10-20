<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupUrlsInterface;
use Magento\Backend\Model\UrlInterface;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Framework\Data\Form\FormKey;
use Magento\TestFramework\TestCase\AbstractBackendController;

/**
 * The session endpoint through the real admin: it answers a signed-in administrator with the session's form key and
 * every address the page needs, and it is reached without the URL secret key that every other wizard action needs,
 * so a page whose keys stopped working can still ask for new ones
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SetupSessionTest extends AbstractBackendController
{
    use ResolvesServices;

    /**
     * @var string
     */
    protected $resource = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $uri = 'backend/hryvinskyi_datalayer/setup/session';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_GET;

    /**
     * The answer carries the session's form key, each request endpoint and the links of every scope
     *
     * @return void
     */
    public function testAnswersTheSessionsKeyAndAddresses(): void
    {
        $answer = $this->ask();

        self::assertSame(200, $this->response()->getHttpResponseCode());
        self::assertSame($this->service(FormKey::class)->getFormKey(), $answer['formKey'] ?? null);
        self::assertIsArray($answer['endpoints'] ?? null);
        self::assertSame(['save', 'preview', 'products', 'session'], array_keys($answer['endpoints']));
        foreach ($answer['endpoints'] as $url) {
            self::assertIsString($url);
            self::assertStringContainsString('/hryvinskyi_datalayer/setup/', $url);
        }
        self::assertIsArray($answer['links'] ?? null);
        self::assertSame(['advanced', 'close'], array_keys($answer['links']));
        self::assertIsArray($answer['links']['advanced']);
        self::assertArrayHasKey('default', $answer['links']['advanced']);
        self::assertArrayHasKey('website:1', $answer['links']['advanced']);
        self::assertIsArray($answer['links']['close']);
        self::assertIsString($answer['links']['close']['default'] ?? null);
        self::assertStringContainsString('section/hryvinskyi_datalayer', $answer['links']['close']['default']);
    }

    /**
     * With secret keys on, the session endpoint answers a request that carries none, where another wizard action
     * sent without its key is turned away
     *
     * @magentoAdminConfigFixture admin/security/use_form_key 1
     * @return void
     */
    public function testIsReachedWithoutTheSecretKey(): void
    {
        $this->service(UrlInterface::class)->turnOnSecretKey();

        $answer = $this->ask();

        self::assertSame(200, $this->response()->getHttpResponseCode());
        self::assertArrayHasKey('formKey', $answer);
    }

    /**
     * The control: with secret keys on, the products endpoint sent without its key is redirected away and never
     * answers its JSON
     *
     * @magentoAdminConfigFixture admin/security/use_form_key 1
     * @return void
     */
    public function testAnotherActionWithoutTheSecretKeyIsTurnedAway(): void
    {
        $this->service(UrlInterface::class)->turnOnSecretKey();
        $request = $this->request();
        $request->setMethod(HttpRequest::METHOD_GET);
        $request->setQueryValue('store', 'store:1');
        $request->setQueryValue('q', 'no product is called this zq');

        $this->dispatch('backend/hryvinskyi_datalayer/setup/products');

        self::assertSame(302, $this->response()->getHttpResponseCode());
        self::assertNotSame('[]', (string) $this->response()->getBody());
    }

    /**
     * With secret keys on, the page's addresses carry one, except the session's, which must work once they stop
     *
     * @magentoAdminConfigFixture admin/security/use_form_key 1
     * @return void
     */
    public function testOnlyTheSessionAddressCarriesNoSecretKey(): void
    {
        $this->service(UrlInterface::class)->turnOnSecretKey();

        $endpoints = $this->service(SetupUrlsInterface::class)->getRequestEndpoints();

        self::assertStringNotContainsString('/key/', $endpoints['session']);
        foreach (['save', 'preview', 'products'] as $endpoint) {
            self::assertStringContainsString('/key/', $endpoints[$endpoint], $endpoint);
        }
    }

    /**
     * Ask the session endpoint as the browser does, without a secret key, and decode the answer
     *
     * @return array<mixed>
     */
    private function ask(): array
    {
        $request = $this->request();
        $request->setMethod(HttpRequest::METHOD_GET);
        $request->setQueryValue('isAjax', 'true');

        $this->dispatch($this->uri);

        $answer = json_decode((string) $this->response()->getBody(), true);
        self::assertIsArray($answer, (string) $this->response()->getBody());

        return $answer;
    }

    /**
     * Get the request
     *
     * @return HttpRequest
     */
    private function request(): HttpRequest
    {
        $request = $this->getRequest();
        self::assertInstanceOf(HttpRequest::class, $request);

        return $request;
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
