<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Integration\Setup;

use Hryvinskyi\DataLayer\Test\Integration\ResolvesServices;
use Magento\Framework\App\Config\ReinitableConfigInterface;
use Magento\Framework\App\Config\ScopeConfigInterface;
use Magento\Framework\App\Request\Http as HttpRequest;
use Magento\Framework\App\Response\Http as HttpResponse;
use Magento\Framework\Data\Form\FormKey;
use Magento\Store\Model\StoreManagerInterface;
use Magento\TestFramework\TestCase\AbstractBackendController;

/**
 * The wizard's endpoints through the real admin, called the way its browser code calls them: a JSON body, `isAjax`
 * and, on a POST, the form key in the query string
 *
 * A form key the query does not carry is refused with the admin's JSON answer rather than a redirect, so the browser
 * can tell an expired page from a broken one. A save writes the row and answers with each result and the new state;
 * a request that cannot be read answers 400 with the reason.
 *
 * @magentoAppArea adminhtml
 * @magentoAppIsolation enabled
 * @magentoDbIsolation enabled
 */
class SetupEndpointsTest extends AbstractBackendController
{
    use ResolvesServices;

    private const CONTAINER_ID = 'GTM-WIZ4RD7';
    private const SET_CONTAINER_ID = [
        'scope' => 'default',
        'key' => 'container_id',
        'op' => 'set',
        'value' => self::CONTAINER_ID,
    ];

    /**
     * @var string
     */
    protected $resource = 'Hryvinskyi_DataLayerAdminUi::config';

    /**
     * @var string
     */
    protected $uri = 'backend/hryvinskyi_datalayer/setup/save';

    /**
     * @var string
     */
    protected $httpMethod = HttpRequest::METHOD_POST;

    /**
     * Send every request the way the browser does: as AJAX, with the form key in the query string and a JSON body
     *
     * @inheritDoc
     */
    protected function setUp(): void
    {
        parent::setUp();
        $request = $this->httpRequest();
        $request->setQueryValue('isAjax', 'true');
        $request->setQueryValue('form_key', $this->service(FormKey::class)->getFormKey());
        $request->setContent('{"changes":[]}');
    }

    /**
     * A change saved through the endpoint is stored, its result says so, and the state in the answer shows it
     *
     * @return void
     */
    public function testSaveRoundTrip(): void
    {
        $answer = $this->post('save', [
            'changes' => [self::SET_CONTAINER_ID],
        ]);

        self::assertSame(
            [['scope' => 'default', 'key' => 'container_id', 'status' => 'saved']],
            $answer['results'] ?? null
        );
        $this->service(ReinitableConfigInterface::class)->reinit();
        self::assertSame(self::CONTAINER_ID, $this->settingValue($answer, 'container_id', 'default'));
    }

    /**
     * A form key the query does not carry, or a wrong one, is refused with the admin's JSON answer, and nothing runs
     *
     * @return void
     */
    public function testFormKeyIsReadFromTheQuery(): void
    {
        $request = $this->httpRequest();
        $request->setQueryValue('form_key', 'not-the-form-key');

        $answer = $this->post('save', [
            'changes' => [self::SET_CONTAINER_ID],
        ]);

        self::assertTrue($answer['error'] ?? null);
        self::assertArrayNotHasKey('results', $answer);
        self::assertFalse($this->response()->getHeader('Location'));
    }

    /**
     * A body that is not a list of changes answers 400 with the reason
     *
     * @return void
     */
    public function testUnreadableSaveAnswers400(): void
    {
        $answer = $this->post('save', ['changes' => 'all'], 400);

        self::assertSame(['error' => 'The request must carry the changes as a list.'], $answer);
    }

    /**
     * A request the saver refuses as a whole answers 400 with the saver's reason
     *
     * @return void
     */
    public function testRefusedSaveAnswers400(): void
    {
        $answer = $this->post('save', [
            'changes' => [['scope' => 'website:999999', 'key' => 'container_id', 'op' => 'inherit']],
        ], 400);

        self::assertSame(['error' => 'The scope "website:999999" does not exist.'], $answer);
    }

    /**
     * A choice that is not one of the field's options is refused by the server, whatever the browser checked: the
     * save answers 400 and writes nothing, not even the request's valid change
     *
     * @return void
     */
    public function testSaveOfAChoiceThatIsNotAnOptionIsRefused(): void
    {
        $refusal = ['error' => '"cost" is not one of the choices of the setting "item_id".'];

        $saved = $this->post('save', [
            'changes' => [
                self::SET_CONTAINER_ID,
                ['scope' => 'default', 'key' => 'item_id', 'op' => 'set', 'value' => 'cost'],
            ],
        ], 400);
        self::assertSame($refusal, $saved);
        $this->service(ReinitableConfigInterface::class)->reinit();
        self::assertNotSame(
            self::CONTAINER_ID,
            $this->service(ScopeConfigInterface::class)->getValue('hryvinskyi_datalayer/gtm/container_id')
        );
    }

    /**
     * A preview drafting a choice that is not one of the field's options answers 400, as the save would
     *
     * @return void
     */
    public function testPreviewOfAChoiceThatIsNotAnOptionIsRefused(): void
    {
        $previewed = $this->post('preview', [
            'store' => 'store:' . $this->storeViewId(),
            'kind' => 'view_item',
            'product' => null,
            'priceVisible' => true,
            'settings' => ['item_id' => 'cost'],
        ], 400);
        self::assertSame(['error' => '"cost" is not one of the choices of the setting "item_id".'], $previewed);
    }

    /**
     * A product search in a store view the store does not have answers 400 and reads no product
     *
     * @return void
     */
    public function testProductsOfAnUnknownStoreViewAnswer400(): void
    {
        $request = $this->httpRequest();
        $request->setMethod(HttpRequest::METHOD_GET);
        $request->setQueryValue('store', 'store:987654');
        $request->setQueryValue('q', 'bag');

        self::assertSame(['error' => 'No store view has the id 987654.'], $this->answer('products', 400));
    }

    /**
     * The preview runs for a store view and answers with its outcome
     *
     * @return void
     */
    public function testPreview(): void
    {
        $answer = $this->post('preview', [
            'store' => 'store:' . $this->storeViewId(),
            'kind' => 'view_item',
            'product' => null,
            'priceVisible' => true,
            'settings' => [],
        ]);
        self::assertSame(
            ['status' => 'unavailable', 'reason' => 'Search for a product to see what its page sends.'],
            $answer
        );
    }

    /**
     * A preview for a scope that is no store view answers 400
     *
     * @return void
     */
    public function testPreviewOfAWebsiteAnswers400(): void
    {
        $answer = $this->post('preview', [
            'store' => 'website:1',
            'kind' => 'view_item',
            'product' => null,
            'priceVisible' => true,
            'settings' => [],
        ], 400);
        self::assertSame(['error' => '"website:1" is not a store view.'], $answer);
    }

    /**
     * The product search answers a list for a store view
     *
     * @return void
     */
    public function testProducts(): void
    {
        $request = $this->httpRequest();
        $request->setMethod(HttpRequest::METHOD_GET);
        $request->setQueryValue('store', 'store:' . $this->storeViewId());
        $request->setQueryValue('q', 'no product is called this zq');

        self::assertSame([], $this->answer('products', 200));
    }

    /**
     * The product search answers 400 without a store view
     *
     * @return void
     */
    public function testProductsWithoutAStoreViewAnswer400(): void
    {
        $request = $this->httpRequest();
        $request->setMethod(HttpRequest::METHOD_GET);
        $request->setQueryValue('q', 'bag');

        self::assertSame(['error' => '"" is not a store view.'], $this->answer('products', 400));
    }

    /**
     * Post a JSON body to an endpoint and decode the answer
     *
     * @param string $endpoint
     * @param array<string, mixed> $body
     * @param int $status The status the answer must have
     * @return array<mixed>
     */
    private function post(string $endpoint, array $body, int $status = 200): array
    {
        $request = $this->httpRequest();
        $request->setMethod(HttpRequest::METHOD_POST);
        $request->setContent((string) json_encode($body));

        return $this->answer($endpoint, $status);
    }

    /**
     * Dispatch the request to an endpoint and decode its JSON answer
     *
     * @param string $endpoint
     * @param int $status The status the answer must have
     * @return array<mixed>
     */
    private function answer(string $endpoint, int $status): array
    {
        $this->dispatch('backend/hryvinskyi_datalayer/setup/' . $endpoint);
        $response = $this->response();
        self::assertSame($status, $response->getHttpResponseCode(), (string) $response->getBody());
        $answer = json_decode((string) $response->getBody(), true);
        self::assertIsArray($answer);

        return $answer;
    }

    /**
     * Read a setting's own value at a scope from a state
     *
     * @param array<mixed> $answer
     * @param string $key
     * @param string $scopeId
     * @return mixed
     */
    private function settingValue(array $answer, string $key, string $scopeId): mixed
    {
        $state = $answer['state'] ?? null;
        self::assertIsArray($state);
        self::assertIsArray($state['settings'] ?? null);
        foreach ($state['settings'] as $setting) {
            if (is_array($setting) && ($setting['key'] ?? null) === $key) {
                return is_array($setting['values'] ?? null) ? ($setting['values'][$scopeId] ?? null) : null;
            }
        }
        self::fail(sprintf('The state has no setting "%s".', $key));
    }

    /**
     * Get the default store view's id
     *
     * @return int
     */
    private function storeViewId(): int
    {
        $store = $this->service(StoreManagerInterface::class)->getDefaultStoreView();
        self::assertNotNull($store);

        return (int) $store->getId();
    }

    /**
     * Get the request
     *
     * @return HttpRequest
     */
    private function httpRequest(): HttpRequest
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
