<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\Http;

use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\JsonBody;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\PreviewRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\ProductSearchRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\SaveRequestReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Http\StoreViewParameter;
use Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup\ScopeIdFactoryStub;
use Magento\Framework\App\RequestInterface;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's endpoints read their requests strictly: a JSON object body with each field of the expected type, a
 * store view written as its scope id; anything else is refused with a message for the person, before any use case runs
 */
class RequestReadersTest extends TestCase
{
    use BuildsRequests;

    /**
     * A JSON object is read as its fields; an empty object has none
     *
     * @return void
     */
    public function testBodyIsTheObjectsFields(): void
    {
        $body = new JsonBody(new Json());

        self::assertSame(['changes' => [], 'n' => 1], $body->read($this->request('{"changes":[],"n":1}')));
        self::assertSame([], $body->read($this->request('{}')));
    }

    /**
     * A body that is missing, malformed, or JSON other than an object is refused with one message, and a request
     * that carries no body at all likewise
     *
     * @return void
     */
    public function testBodyThatIsNotAnObjectIsRefused(): void
    {
        $body = new JsonBody(new Json());
        $requests = [
            'empty' => $this->request(''),
            'malformed' => $this->request('{"changes":'),
            'list' => $this->request('[1,2]'),
            'text' => $this->request('"changes"'),
            'number' => $this->request('4'),
            'no body' => $this->createMock(RequestInterface::class),
        ];
        foreach ($requests as $case => $request) {
            try {
                $body->read($request);
                self::fail(sprintf('The %s body was read.', $case));
            } catch (\InvalidArgumentException $refusal) {
                self::assertSame('The request must carry a JSON object.', $refusal->getMessage(), $case);
            }
        }
    }

    /**
     * A store view's scope id gives its id; the default scope, a website, or anything else is no store view
     *
     * @return void
     */
    public function testStoreViewIsReadFromItsScopeId(): void
    {
        $parameter = new StoreViewParameter(new ScopeIdFactoryStub());

        self::assertSame(12, $parameter->read('store:12'));
        foreach (['default', 'website:1', 'store:0', 'store:x', '12', 12, null, ['store:1']] as $value) {
            try {
                $parameter->read($value);
                self::fail(sprintf('%s was read as a store view.', var_export($value, true)));
            } catch (\InvalidArgumentException $refusal) {
                self::assertStringContainsString('is not a store view.', $refusal->getMessage());
            }
        }
    }

    /**
     * The save request is the list of changes, handed on as sent; a body without a list is refused
     *
     * @return void
     */
    public function testSaveRequestIsTheListOfChanges(): void
    {
        $reader = new SaveRequestReader(new JsonBody(new Json()));
        $change = ['scope' => 'default', 'key' => 'enabled', 'op' => 'set', 'value' => true];

        self::assertSame([$change], $reader->read($this->request((string) json_encode(['changes' => [$change]]))));
        self::assertSame([], $reader->read($this->request('{"changes":[]}')));
        foreach (['{}', '{"changes":{"a":1}}', '{"changes":"all"}'] as $body) {
            try {
                $reader->read($this->request($body));
                self::fail(sprintf('%s was read as changes.', $body));
            } catch (\InvalidArgumentException $refusal) {
                self::assertSame('The request must carry the changes as a list.', $refusal->getMessage());
            }
        }
    }

    /**
     * Every field of the preview request comes out typed, the product may be left unchosen and the settings empty
     *
     * @return void
     */
    public function testPreviewRequestIsReadFieldByField(): void
    {
        $reader = $this->previewReader();

        self::assertSame(
            [
                'storeId' => 3,
                'kind' => 'view_item',
                'productId' => 42,
                'priceVisible' => false,
                'settings' => ['enabled' => true, 'events' => ['off' => ['sample_server_event'], 'channels' => []]],
            ],
            $reader->read($this->request((string) json_encode([
                'store' => 'store:3',
                'kind' => 'view_item',
                'product' => 42,
                'priceVisible' => false,
                'settings' => ['enabled' => true, 'events' => ['off' => ['sample_server_event'], 'channels' => []]],
            ])))
        );
        self::assertSame(
            ['storeId' => 1, 'kind' => 'purchase', 'productId' => null, 'priceVisible' => true, 'settings' => []],
            $reader->read($this->request(
                '{"store":"store:1","kind":"purchase","product":null,"priceVisible":true,"settings":{}}'
            ))
        );
    }

    /**
     * A preview field missing or of the wrong type is refused
     *
     * @return void
     */
    public function testPreviewRequestWithAWrongFieldIsRefused(): void
    {
        $reader = $this->previewReader();
        $valid = [
            'store' => 'store:1',
            'kind' => 'view_item',
            'product' => 5,
            'priceVisible' => true,
            'settings' => [],
        ];
        $broken = [
            'store' => 'website:1',
            'kind' => '',
            'product' => '5',
            'priceVisible' => 'yes',
            'settings' => ['enabled'],
        ];
        foreach ($broken as $field => $value) {
            $fields = array_replace($valid, [$field => $value]);
            try {
                $reader->read($this->request((string) json_encode($fields)));
                self::fail(sprintf('A preview with a wrong %s was read.', $field));
            } catch (\InvalidArgumentException $refusal) {
                self::assertNotSame('', $refusal->getMessage(), $field);
            }
        }
        foreach (array_keys($valid) as $field) {
            $fields = $valid;
            unset($fields[$field]);
            if ($field === 'product') {
                self::assertNull($reader->read($this->request((string) json_encode($fields)))['productId']);
                continue;
            }
            try {
                $reader->read($this->request((string) json_encode($fields)));
                self::fail(sprintf('A preview without %s was read.', $field));
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /**
     * The product search reads the store view and the text from the query; no text is an empty one
     *
     * @return void
     */
    public function testProductSearchIsReadFromTheQuery(): void
    {
        $reader = new ProductSearchRequestReader(new StoreViewParameter(new ScopeIdFactoryStub()));

        self::assertSame(
            ['storeId' => 2, 'query' => ' bag '],
            $reader->read($this->request('', ['store' => 'store:2', 'q' => ' bag ']))
        );
        self::assertSame(['storeId' => 2, 'query' => ''], $reader->read($this->request('', ['store' => 'store:2'])));
        foreach ([['q' => 'bag'], ['store' => 'default', 'q' => 'bag'], ['store' => 'store:2', 'q' => ['bag']]] as $p) {
            try {
                $reader->read($this->request('', $p));
                self::fail(sprintf('The search %s was read.', (string) json_encode($p)));
            } catch (\InvalidArgumentException) {
                $this->addToAssertionCount(1);
            }
        }
    }

    /**
     * Build the preview reader over the real body and store view readers
     *
     * @return PreviewRequestReader
     */
    private function previewReader(): PreviewRequestReader
    {
        return new PreviewRequestReader(new JsonBody(new Json()), new StoreViewParameter(new ScopeIdFactoryStub()));
    }
}
