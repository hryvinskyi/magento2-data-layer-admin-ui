<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Controller\Adminhtml\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventPreviewInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ProductSearchInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSaverInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupSessionInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;
use Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup\Index;
use Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup\Preview;
use Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup\Products;
use Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup\Save;
use Hryvinskyi\DataLayerAdminUi\Controller\Adminhtml\Setup\Session;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\JsonAnswer;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\JsonBody;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\PreviewRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\ProductSearchRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\SaveRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\StoreViewParameter;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Http\BuildsRequests;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\RecordingLogger;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\ScopeIdFactoryStub;
use Magento\Backend\App\Action\Context;
use Magento\Backend\Model\View\Result\Page;
use Magento\Framework\App\RequestContentInterface;
use Magento\Framework\Controller\Result\Json;
use Magento\Framework\Controller\Result\JsonFactory;
use Magento\Framework\Phrase;
use Magento\Framework\Serialize\Serializer\Json as JsonSerializer;
use Magento\Framework\View\Result\PageFactory;
use PHPUnit\Framework\TestCase;

/**
 * Each endpoint reads its request, hands it to its use case and answers with what that returns; a request that cannot
 * be read, or that the use case refuses as a whole, answers 400 with the reason and reaches nothing further; anything
 * else that goes wrong is logged and answers 500 with a generic sentence, never the exception's own message
 */
class SetupEndpointsTest extends TestCase
{
    use BuildsRequests;

    private const GENERIC = 'The request could not be completed. Details are in the log.';

    /**
     * What the endpoints logged
     *
     * @var RecordingLogger
     */
    private RecordingLogger $logger;

    /**
     * Start every test with nothing logged
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->logger = new RecordingLogger();
    }

    /**
     * What each endpoint answered: the status code set, if any, and the data
     *
     * @var list<array{code: int|null, data: mixed}>
     */
    private array $answers = [];

    /**
     * What each use case was asked
     *
     * @var list<mixed>
     */
    private array $calls = [];

    /**
     * The changes go to the saver, and the answer carries its results and the state read after the save
     *
     * @return void
     */
    public function testSaveDelegatesAndAnswersResultsAndState(): void
    {
        $change = ['scope' => 'default', 'key' => 'enabled', 'op' => 'set', 'value' => true];
        $result = ['scope' => 'default', 'key' => 'enabled', 'status' => 'saved'];

        $this->save((string) json_encode(['changes' => [$change]]), [$result])->execute();

        self::assertSame([['save', [$change]], ['state']], $this->calls);
        self::assertSame(
            [['code' => null, 'data' => ['results' => [$result], 'state' => $this->state()]]],
            $this->answers
        );
    }

    /**
     * A body without a list of changes, or a request the saver refuses, answers 400 with the reason and no state
     *
     * @return void
     */
    public function testSaveRefusalAnswers400(): void
    {
        $this->save('{"changes":"all"}', [])->execute();
        $refusal = new InvalidSetupRequestException(new Phrase('The scope "%1" does not exist.', ['nowhere']));
        $this->save('{"changes":[{"scope":"nowhere"}]}', $refusal)->execute();

        self::assertSame([['save', [['scope' => 'nowhere']]]], $this->calls);
        self::assertSame([
            ['code' => 400, 'data' => ['error' => 'The request must carry the changes as a list.']],
            ['code' => 400, 'data' => ['error' => 'The scope "nowhere" does not exist.']],
        ], $this->answers);
        self::assertSame([], $this->logger->records);
    }

    /**
     * A save that fails for any other reason answers 500 with a generic sentence, and the failure is logged with the
     * endpoint
     *
     * @return void
     */
    public function testSaveFailureAnswers500AndIsLogged(): void
    {
        $this->save('{"changes":[]}', new \RuntimeException('SQLSTATE[HY000]: database gone'))->execute();

        $this->assertFailedAndLogged('save');
    }

    /**
     * The preview gets the store view's id and the other fields as sent, and its answer is the endpoint's
     *
     * @return void
     */
    public function testPreviewDelegatesWithTheStoreViewId(): void
    {
        $answer = ['status' => 'sent', 'event' => ['event' => 'view_item']];

        $this->preview(
            '{"store":"store:4","kind":"view_item","product":7,"priceVisible":false,"settings":{"enabled":true}}',
            $answer
        )->execute();

        self::assertSame([['preview', 4, 'view_item', 7, false, ['enabled' => true]]], $this->calls);
        self::assertSame([['code' => null, 'data' => $answer]], $this->answers);
    }

    /**
     * A store that is not a store view, or a request the preview refuses, answers 400
     *
     * @return void
     */
    public function testPreviewRefusalAnswers400(): void
    {
        $this->preview('{"store":"website:1","kind":"view_item","priceVisible":true,"settings":{}}', [])->execute();
        $this->preview(
            '{"store":"store:1","kind":"unknown_kind","priceVisible":true,"settings":{}}',
            new InvalidSetupRequestException(new Phrase('No event preview is registered under "%1".', ['unknown_kind']))
        )->execute();

        self::assertSame([['preview', 1, 'unknown_kind', null, true, []]], $this->calls);
        self::assertSame([
            ['code' => 400, 'data' => ['error' => '"website:1" is not a store view.']],
            ['code' => 400, 'data' => ['error' => 'No event preview is registered under "unknown_kind".']],
        ], $this->answers);
        self::assertSame([], $this->logger->records);
    }

    /**
     * A preview that fails for any other reason, a framework's own invalid argument included, answers 500 and is
     * logged
     *
     * @return void
     */
    public function testPreviewFailureAnswers500AndIsLogged(): void
    {
        $this->preview(
            '{"store":"store:1","kind":"view_item","priceVisible":true,"settings":{}}',
            new \InvalidArgumentException('Unknown column "x" in the product table')
        )->execute();

        $this->assertFailedAndLogged('preview');
    }

    /**
     * The search gets the store view's id and the text, and its products are the answer; no store view answers 400
     *
     * @return void
     */
    public function testProductsDelegatesOrAnswers400(): void
    {
        $products = [['id' => 3, 'sku' => 'BAG-20', 'name' => 'Canvas backpack 20 L']];

        $this->products(['store' => 'store:2', 'q' => 'bag'], $products)->execute();
        $this->products(['q' => 'bag'], $products)->execute();
        $this->products(
            ['store' => 'store:9', 'q' => 'bag'],
            new InvalidSetupRequestException(new Phrase('No store view has the id %1.', [9]))
        )->execute();

        self::assertSame([['search', 2, 'bag'], ['search', 9, 'bag']], $this->calls);
        self::assertSame([
            ['code' => null, 'data' => $products],
            ['code' => 400, 'data' => ['error' => '"" is not a store view.']],
            ['code' => 400, 'data' => ['error' => 'No store view has the id 9.']],
        ], $this->answers);
    }

    /**
     * A search that fails for any other reason answers 500 and is logged
     *
     * @return void
     */
    public function testProductsFailureAnswers500AndIsLogged(): void
    {
        $this->products(['store' => 'store:2', 'q' => 'bag'], new \RuntimeException('index offline'))->execute();

        $this->assertFailedAndLogged('products');
    }

    /**
     * The session endpoint answers with what the session use case describes, and is reached without the URL secret
     * key; a failure answers 500 and is logged
     *
     * @return void
     */
    public function testSessionAnswersTheSessionsKeyAndAddresses(): void
    {
        $described = [
            'formKey' => 'new-key',
            'endpoints' => ['save' => 's', 'preview' => 'p', 'products' => 'r', 'session' => 'n'],
            'links' => ['advanced' => ['default' => 'a'], 'close' => ['default' => 'c']],
        ];

        $this->session($described)->execute();
        self::assertSame([['code' => null, 'data' => $described]], $this->answers);

        $this->answers = [];
        $this->session(new \RuntimeException('no session storage'))->execute();
        $this->assertFailedAndLogged('session');
    }

    /**
     * The page is the admin page with the wizard's menu item active
     *
     * @return void
     */
    public function testIndexMarksItsMenuItem(): void
    {
        $page = $this->createMock(Page::class);
        $page->expects(self::once())->method('setActiveMenu')->with('Hryvinskyi_DataLayerAdminUi::setup_menu');
        $pageFactory = $this->createMock(PageFactory::class);
        $pageFactory->method('create')->willReturn($page);

        self::assertSame($page, (new Index($this->context($this->request()), $pageFactory))->execute());
    }

    /**
     * Assert the one answer is a 500 with the generic sentence, and the failure was logged with its endpoint
     *
     * @param string $endpoint
     * @return void
     */
    private function assertFailedAndLogged(string $endpoint): void
    {
        self::assertSame([['code' => 500, 'data' => ['error' => self::GENERIC]]], $this->answers);
        self::assertCount(1, $this->logger->records);
        self::assertSame($endpoint, $this->logger->records[0]['context']['endpoint'] ?? null);
        self::assertInstanceOf(\Throwable::class, $this->logger->records[0]['context']['exception'] ?? null);
    }

    /**
     * The save endpoint over a request with the body given and a saver that answers or throws as given
     *
     * @param string $body
     * @param list<array<string, string>>|\Throwable $outcome
     * @return Save
     */
    private function save(string $body, array|\Throwable $outcome): Save
    {
        $saver = $this->createMock(SetupSaverInterface::class);
        $saver->method('save')->willReturnCallback(function (array $changes) use ($outcome): array {
            $this->calls[] = ['save', $changes];
            if ($outcome instanceof \Throwable) {
                throw $outcome;
            }

            return $outcome;
        });
        $stateProvider = $this->createMock(SetupStateProviderInterface::class);
        $stateProvider->method('getState')->willReturnCallback(function (): array {
            $this->calls[] = ['state'];

            return $this->state();
        });

        return new Save(
            $this->context($this->request($body)),
            new SaveRequestReader(new JsonBody(new JsonSerializer())),
            $saver,
            $stateProvider,
            $this->jsonAnswer()
        );
    }

    /**
     * The preview endpoint over a request with the body given and a preview that answers or throws as given
     *
     * @param string $body
     * @param array<string, mixed>|\Throwable $outcome
     * @return Preview
     */
    private function preview(string $body, array|\Throwable $outcome): Preview
    {
        $preview = $this->createMock(EventPreviewInterface::class);
        $preview->method('preview')->willReturnCallback(
            function (
                int $storeId,
                string $kind,
                ?int $productId,
                bool $priceVisible,
                array $settings
            ) use ($outcome): array {
                $this->calls[] = ['preview', $storeId, $kind, $productId, $priceVisible, $settings];
                if ($outcome instanceof \Throwable) {
                    throw $outcome;
                }

                return $outcome;
            }
        );

        return new Preview(
            $this->context($this->request($body)),
            new PreviewRequestReader(
                new JsonBody(new JsonSerializer()),
                new StoreViewParameter(new ScopeIdFactoryStub())
            ),
            $preview,
            $this->jsonAnswer()
        );
    }

    /**
     * The products endpoint over a request with the parameters given and a search that finds the products given, or
     * throws
     *
     * @param array<string, mixed> $params
     * @param list<array{id: int, sku: string, name: string}>|\Throwable $outcome
     * @return Products
     */
    private function products(array $params, array|\Throwable $outcome): Products
    {
        $search = $this->createMock(ProductSearchInterface::class);
        $search->method('search')->willReturnCallback(function (int $storeId, string $query) use ($outcome): array {
            $this->calls[] = ['search', $storeId, $query];
            if ($outcome instanceof \Throwable) {
                throw $outcome;
            }

            return $outcome;
        });

        return new Products(
            $this->context($this->request('', $params)),
            new ProductSearchRequestReader(new StoreViewParameter(new ScopeIdFactoryStub())),
            $search,
            $this->jsonAnswer()
        );
    }

    /**
     * The session endpoint over a session use case that describes or throws as given
     *
     * @param array<string, mixed>|\Throwable $outcome
     * @return Session
     */
    private function session(array|\Throwable $outcome): Session
    {
        $session = $this->createMock(SetupSessionInterface::class);
        $session->method('describe')->willReturnCallback(static function () use ($outcome): array {
            if ($outcome instanceof \Throwable) {
                throw $outcome;
            }

            return $outcome;
        });

        return new Session($this->context($this->request()), $session, $this->jsonAnswer());
    }

    /**
     * The real JSON answer over the recording factory and logger
     *
     * @return JsonAnswer
     */
    private function jsonAnswer(): JsonAnswer
    {
        return new JsonAnswer($this->jsonFactory(), $this->logger);
    }

    /**
     * An admin action context carrying the request
     *
     * @param RequestContentInterface $request
     * @return Context
     */
    private function context(RequestContentInterface $request): Context
    {
        $context = $this->createMock(Context::class);
        $context->method('getRequest')->willReturn($request);

        return $context;
    }

    /**
     * A JSON result factory whose results record what they are given
     *
     * @return JsonFactory
     */
    private function jsonFactory(): JsonFactory
    {
        $factory = $this->createMock(JsonFactory::class);
        $factory->method('create')->willReturnCallback(function (): Json {
            $code = null;
            $json = $this->createMock(Json::class);
            $json->method('setHttpResponseCode')->willReturnCallback(
                static function (int $status) use (&$code, $json): Json {
                    $code = $status;

                    return $json;
                }
            );
            $json->method('setData')->willReturnCallback(function (mixed $data) use (&$code, $json): Json {
                $this->answers[] = ['code' => $code, 'data' => $data];

                return $json;
            });

            return $json;
        });

        return $factory;
    }

    /**
     * A small state
     *
     * @return array<string, mixed>
     */
    private function state(): array
    {
        return ['scopes' => [['id' => 'default']], 'settings' => [], 'events' => []];
    }
}
