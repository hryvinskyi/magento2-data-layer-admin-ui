<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\BuiltInDefaultsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldPathInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoredSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Events\StoredEventSettings;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\ConfigGroupsBuilder;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\EventsSettingState;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields\EventsSettingFields;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields\RegisteredSettingFields;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\FlagKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\TextKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\ScopedValuesReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingDescriptors;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingFieldsPool;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingKinds;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupSaver;
use Magento\Framework\Exception\LocalizedException;
use Magento\Framework\Phrase;
use Magento\Framework\Serialize\Serializer\Json;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/**
 * The saver checks the whole request before it writes anything, then saves each scope's changes in one save, default
 * first, then websites, then store views; when a scope's save fails it saves the changes one by one so only the
 * refused one fails; a fixed setting is not attempted; an unexpected failure is logged and reported generically
 */
class SetupSaverTest extends TestCase
{
    use EventsFixture;

    private const LOCK = 'Fixed by the deployment configuration.';
    private const GENERIC = 'This setting could not be saved. Details are in the log.';

    /**
     * @var RecordingSectionWriter
     */
    private RecordingSectionWriter $writer;

    /**
     * @var RecordingLogger
     */
    private RecordingLogger $logger;

    /**
     * Start with a writer that accepts everything
     *
     * @return void
     */
    protected function setUp(): void
    {
        $this->writer = new RecordingSectionWriter();
        $this->logger = new RecordingLogger();
    }

    /**
     * Each scope's changes go through one save; scopes are saved default first, then websites, then store views, and
     * the results follow the request's order
     *
     * @return void
     */
    public function testOneSavePerScopeInScopeOrder(): void
    {
        $results = $this->saver()->save([
            ['scope' => 'store:1', 'key' => 'enabled', 'op' => 'set', 'value' => true],
            ['scope' => 'default', 'key' => 'container_id', 'op' => 'set', 'value' => ' GTM-A '],
            ['scope' => 'website:1', 'key' => 'api_key', 'op' => 'set', 'value' => 'k-1'],
            ['scope' => 'store:1', 'key' => 'container_id', 'op' => 'inherit'],
            ['scope' => 'website:1', 'key' => 'enabled', 'op' => 'set', 'value' => false],
        ]);

        self::assertSame([
            ['scope' => 'store:1', 'key' => 'enabled', 'status' => 'saved'],
            ['scope' => 'default', 'key' => 'container_id', 'status' => 'saved'],
            ['scope' => 'website:1', 'key' => 'api_key', 'status' => 'saved'],
            ['scope' => 'store:1', 'key' => 'container_id', 'status' => 'saved'],
            ['scope' => 'website:1', 'key' => 'enabled', 'status' => 'saved'],
        ], $results);
        self::assertSame([
            [
                'scope' => 'default',
                'section' => 'section',
                'groups' => ['gtm' => ['fields' => ['container_id' => ['value' => 'GTM-A']]]],
            ],
            [
                'scope' => 'website:1',
                'section' => 'section',
                'groups' => [
                    'server' => ['groups' => ['delivery' => ['fields' => ['api_key' => ['value' => 'k-1']]]]],
                    'general' => ['fields' => ['enabled' => ['value' => '0']]],
                ],
            ],
            [
                'scope' => 'store:1',
                'section' => 'section',
                'groups' => [
                    'general' => ['fields' => ['enabled' => ['value' => '1']]],
                    'gtm' => ['fields' => ['container_id' => ['inherit' => 1]]],
                ],
            ],
        ], $this->writer->attempts);
    }

    /**
     * When a setting's rules refuse its value, the scope's other changes still land and the refused one carries the
     * refusal's own words
     *
     * @return void
     */
    public function testRefusedChangeFailsAlone(): void
    {
        $this->writer = new RecordingSectionWriter([
            'section/gtm/container_id' => new LocalizedException(new Phrase('"%1" is not a container ID.', ['bad'])),
        ]);

        $results = $this->saver()->save([
            ['scope' => 'website:1', 'key' => 'enabled', 'op' => 'set', 'value' => true],
            ['scope' => 'website:1', 'key' => 'container_id', 'op' => 'set', 'value' => 'bad'],
            ['scope' => 'website:1', 'key' => 'api_key', 'op' => 'set', 'value' => 'k-1'],
        ]);

        self::assertSame([
            ['scope' => 'website:1', 'key' => 'enabled', 'status' => 'saved'],
            [
                'scope' => 'website:1',
                'key' => 'container_id',
                'status' => 'failed',
                'message' => '"bad" is not a container ID.',
            ],
            ['scope' => 'website:1', 'key' => 'api_key', 'status' => 'saved'],
        ], $results);
        self::assertCount(4, $this->writer->attempts, 'One save together, then one per change');
        self::assertSame(
            [['general' => ['fields' => ['enabled' => ['value' => '1']]]], [
                'server' => ['groups' => ['delivery' => ['fields' => ['api_key' => ['value' => 'k-1']]]]],
            ]],
            array_column($this->writer->writes, 'groups')
        );
        self::assertSame([], $this->logger->records);
    }

    /**
     * An unexpected failure is logged with what failed and reported in general words, never in its own; a single
     * change is saved once
     *
     * @return void
     */
    public function testUnexpectedFailureIsLoggedAndReportedGenerically(): void
    {
        $failure = new \RuntimeException('Deadlock on table core_config_data');
        $this->writer = new RecordingSectionWriter(['section/server/delivery/api_key' => $failure]);

        $results = $this->saver()->save([
            ['scope' => 'website:2', 'key' => 'api_key', 'op' => 'set', 'value' => 'k-2'],
        ]);

        self::assertSame(
            [['scope' => 'website:2', 'key' => 'api_key', 'status' => 'failed', 'message' => self::GENERIC]],
            $results
        );
        self::assertCount(1, $this->writer->attempts);
        self::assertCount(1, $this->logger->records);
        self::assertSame('website:2', $this->logger->records[0]['context']['scope'] ?? null);
        self::assertSame('api_key', $this->logger->records[0]['context']['key'] ?? null);
        self::assertSame($failure, $this->logger->records[0]['context']['exception'] ?? null);
    }

    /**
     * A scope whose save fails for an unexpected reason is logged once for the scope, then saved change by change
     *
     * @return void
     */
    public function testUnexpectedScopeFailureFallsBackToOneByOne(): void
    {
        $this->writer = new RecordingSectionWriter(['section/server/delivery/api_key' => new \RuntimeException('x')]);

        $results = $this->saver()->save([
            ['scope' => 'website:1', 'key' => 'api_key', 'op' => 'set', 'value' => 'k-1'],
            ['scope' => 'website:1', 'key' => 'enabled', 'op' => 'set', 'value' => true],
        ]);

        self::assertSame(['failed', 'saved'], array_column($results, 'status'));
        self::assertCount(2, $this->logger->records, 'The scope and the change');
    }

    /**
     * A setting the deployment configuration fixes at the scope is not attempted; the scope's other changes are saved
     *
     * @return void
     */
    public function testFixedSettingIsNotAttempted(): void
    {
        $results = $this->saver()->save([
            ['scope' => 'website:2', 'key' => 'container_id', 'op' => 'set', 'value' => 'GTM-B'],
            ['scope' => 'website:2', 'key' => 'enabled', 'op' => 'set', 'value' => true],
        ]);

        self::assertSame([
            ['scope' => 'website:2', 'key' => 'container_id', 'status' => 'failed', 'message' => self::LOCK],
            ['scope' => 'website:2', 'key' => 'enabled', 'status' => 'saved'],
        ], $results);
        self::assertSame(
            [['general' => ['fields' => ['enabled' => ['value' => '1']]]]],
            array_column($this->writer->attempts, 'groups')
        );
    }

    /**
     * The events setting posts both its fields in the scope's save, the unknown entries it inherits included;
     * inheriting it removes both
     *
     * @return void
     */
    public function testEventsSettingPostsBothFields(): void
    {
        $results = $this->saver()->save([
            ['scope' => 'store:1', 'key' => 'events', 'op' => 'set', 'value' => [
                'off' => ['view_item'],
                'channels' => ['purchase' => 'server', 'sample_server_event' => 'browser'],
            ]],
            ['scope' => 'store:2', 'key' => 'events', 'op' => 'inherit'],
        ]);

        self::assertSame(['saved', 'saved'], array_column($results, 'status'));
        self::assertSame([
            ['events' => ['fields' => [
                'disabled' => ['value' => 'view_item,old_event'],
                'routing' => ['value' => [
                    '__empty' => '',
                    '_0' => ['event' => 'purchase', 'channel' => 'server'],
                    '_1' => ['event' => 'gone_event', 'channel' => 'both'],
                ]],
            ]]],
            ['events' => ['fields' => ['disabled' => ['inherit' => 1], 'routing' => ['inherit' => 1]]]],
        ], array_column($this->writer->attempts, 'groups'));
    }

    /**
     * An invalid request is refused whole, saying why, and nothing is written, not even its valid changes
     *
     * @param list<mixed> $changes
     * @param string $message
     * @return void
     */
    #[DataProvider('invalidRequests')]
    public function testInvalidRequestWritesNothing(array $changes, string $message): void
    {
        $valid = ['scope' => 'default', 'key' => 'enabled', 'op' => 'set', 'value' => true];
        try {
            $this->saver()->save([$valid, ...$changes]);
            self::fail('The request was accepted.');
        } catch (InvalidSetupRequestException $exception) {
            self::assertStringContainsString($message, $exception->getMessage());
        }

        self::assertSame([], $this->writer->attempts);
    }

    /**
     * @return array<string, array{list<mixed>, string}>
     */
    public static function invalidRequests(): array
    {
        $shape = 'Each change needs a scope, a setting and whether it sets a value or inherits it.';

        return [
            'not a change' => [['default'], $shape],
            'no scope' => [[['key' => 'enabled', 'op' => 'inherit']], $shape],
            'scope not text' => [[['scope' => 1, 'key' => 'enabled', 'op' => 'inherit']], $shape],
            'no key' => [[['scope' => 'store:1', 'op' => 'inherit']], $shape],
            'no operation' => [[['scope' => 'store:1', 'key' => 'enabled', 'value' => true]], $shape],
            'unknown operation' => [
                [['scope' => 'store:1', 'key' => 'enabled', 'op' => 'delete']],
                '"delete" is not a change',
            ],
            'set without a value' => [[['scope' => 'store:1', 'key' => 'enabled', 'op' => 'set']], 'sets no value'],
            'unknown scope' => [
                [['scope' => 'store:99', 'key' => 'enabled', 'op' => 'inherit']],
                'The scope "store:99" does not exist.',
            ],
            'malformed scope' => [
                [['scope' => 'stores:1', 'key' => 'enabled', 'op' => 'inherit']],
                'The scope "stores:1" does not exist.',
            ],
            'unknown setting' => [
                [['scope' => 'store:1', 'key' => 'nothing', 'op' => 'inherit']],
                'No wizard setting is registered under "nothing".',
            ],
            'scope below the reach' => [
                [['scope' => 'store:1', 'key' => 'api_key', 'op' => 'set', 'value' => 'k']],
                'The setting "api_key" cannot be set at the scope store:1.',
            ],
            'inherit at the default scope' => [
                [['scope' => 'default', 'key' => 'container_id', 'op' => 'inherit']],
                'The default scope has nothing to inherit "container_id" from.',
            ],
            'value of the wrong kind' => [
                [['scope' => 'store:1', 'key' => 'enabled', 'op' => 'set', 'value' => 'yes']],
                'The setting "enabled" takes true or false.',
            ],
            'events value of the wrong shape' => [
                [['scope' => 'store:1', 'key' => 'events', 'op' => 'set', 'value' => ['off' => 'view_item']]],
                'The events setting takes the events switched off',
            ],
            'same setting twice at a scope' => [
                [['scope' => 'default', 'key' => 'enabled', 'op' => 'set', 'value' => false]],
                'The setting "enabled" is changed twice at the scope default.',
            ],
            'setting the user may not change' => [
                [['scope' => 'default', 'key' => 'foreign', 'op' => 'set', 'value' => 'x']],
                'You are not allowed to change the setting "foreign".',
            ],
            'inherit of a setting the user may not change' => [
                [['scope' => 'store:1', 'key' => 'foreign', 'op' => 'inherit']],
                'You are not allowed to change the setting "foreign".',
            ],
            'text that does not match its pattern' => [
                [['scope' => 'store:1', 'key' => 'stream_id', 'op' => 'set', 'value' => 'UA-1']],
                '"UA-1" is not in the format the setting "stream_id" takes.',
            ],
        ];
    }

    /**
     * Build the saver over the fixture's scopes, settings, stored values and locks, writing to the recording writer
     *
     * @return SetupSaver
     */
    private function saver(): SetupSaver
    {
        $kinds = new SettingKinds(['flag' => new FlagKind(), 'text' => new TextKind()]);
        $descriptors = new SettingDescriptors(new SettingDescriptorFactoryStub(), $kinds, [
            'enabled' => ['path' => 'section/general/enabled', 'kind' => 'flag', 'step' => 'connect'],
            'container_id' => ['path' => 'section/gtm/container_id', 'kind' => 'text', 'step' => 'connect'],
            'stream_id' => [
                'path' => 'section/gtag/stream_id',
                'kind' => 'text',
                'step' => 'connect',
                'pattern' => '/^G-[A-Z0-9]+$/D',
            ],
            'foreign' => ['path' => 'other/group/foreign', 'kind' => 'text', 'step' => 'connect'],
            'api_key' => ['path' => 'section/remote/api_key', 'kind' => 'text', 'step' => 'remote'],
        ]);
        $presentation = $this->presentation();
        $eventsSetting = new EventsSettingState($presentation, $this->eventsProjection());

        return new SetupSaver(
            new SettingFieldsPool(
                new RegisteredSettingFields($descriptors, $kinds, $presentation),
                ['events' => new EventsSettingFields(
                    $eventsSetting,
                    $this->knownEvents(),
                    $this->fixedChannels(),
                    new StoredEventSettings(new Json())
                )]
            ),
            new ScopedValuesReader(
                $this->scopeTree(),
                $this->storedSettings(),
                $this->builtInDefaults(),
                $this->locks(),
                new ScopedValuesFactoryStub()
            ),
            $this->fieldPath(),
            new ConfigGroupsBuilder(),
            $this->writer,
            new ScopeIdFactoryStub(),
            $this->logger,
            new AccessStub(['other/group/foreign'])
        );
    }

    /**
     * Two websites, the first with two store views, the second with one
     *
     * @return ScopeTreeInterface
     */
    private function scopeTree(): ScopeTreeInterface
    {
        return new class implements ScopeTreeInterface {
            /**
             * @inheritDoc
             */
            public function getScopes(): array
            {
                return [
                    ['id' => 'default', 'type' => 'default', 'name' => 'Default', 'code' => '', 'parent' => null],
                    ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base',
                        'parent' => 'default'],
                    ['id' => 'store:1', 'type' => 'store', 'name' => 'One', 'code' => 'one', 'parent' => 'website:1'],
                    ['id' => 'store:2', 'type' => 'store', 'name' => 'Two', 'code' => 'two', 'parent' => 'website:1'],
                    ['id' => 'website:2', 'type' => 'website', 'name' => 'Trade', 'code' => 'tr',
                        'parent' => 'default'],
                    ['id' => 'store:3', 'type' => 'store', 'name' => 'Three', 'code' => 'three',
                        'parent' => 'website:2'],
                ];
            }
        };
    }

    /**
     * Stored event settings: the default scope switches off an unknown event, the main website routes another one
     *
     * @return StoredSettingsInterface
     */
    private function storedSettings(): StoredSettingsInterface
    {
        return new class implements StoredSettingsInterface {
            /**
             * @inheritDoc
             */
            public function read(array $paths): array
            {
                return array_intersect_key([
                    EventsSettingStateInterface::DISABLED_PATH => ['default' => 'login,old_event'],
                    EventsSettingStateInterface::ROUTING_PATH => [
                        'website:1' => '[{"event":"gone_event","channel":"both"},'
                            . '{"event":"purchase","channel":"server"}]',
                    ],
                    'section/gtm/container_id' => ['default' => 'GTM-DEF'],
                ], array_flip($paths));
            }
        };
    }

    /**
     * Nothing is shipped
     *
     * @return BuiltInDefaultsInterface
     */
    private function builtInDefaults(): BuiltInDefaultsInterface
    {
        return new class implements BuiltInDefaultsInterface {
            /**
             * @inheritDoc
             */
            public function read(array $paths): array
            {
                return array_fill_keys($paths, null);
            }
        };
    }

    /**
     * The container id is fixed at the second website
     *
     * @return SettingLocksInterface
     */
    private function locks(): SettingLocksInterface
    {
        return new class implements SettingLocksInterface {
            /**
             * @inheritDoc
             */
            public function read(array $paths, array $scopes): array
            {
                $lock = ['message' => 'Fixed by the deployment configuration.', 'value' => 'GTM-ENV'];

                return in_array('section/gtm/container_id', $paths, true)
                    ? ['section/gtm/container_id' => ['website:2' => $lock]]
                    : [];
            }
        };
    }

    /**
     * Fields reach store views, except the website-only API key
     *
     * @return SettingPresentationInterface
     */
    private function presentation(): SettingPresentationInterface
    {
        return new class implements SettingPresentationInterface {
            /**
             * @inheritDoc
             */
            public function present(string $key, string $path): array
            {
                return [
                    'label' => 'Label of ' . $key,
                    'options' => [],
                    'reach' => $path === 'section/remote/api_key' ? 'website' : 'store',
                ];
            }
        };
    }

    /**
     * Fields sit where they are stored, except the API key, nested in a group of another name, and the routing rows,
     * placed beside the disabled events
     *
     * @return ConfigFieldPathInterface
     */
    private function fieldPath(): ConfigFieldPathInterface
    {
        return new class implements ConfigFieldPathInterface {
            /**
             * @inheritDoc
             */
            public function locate(string $configPath): string
            {
                return [
                    'section/remote/api_key' => 'section/server/delivery/api_key',
                    EventsSettingStateInterface::DISABLED_PATH => 'section/events/disabled',
                    EventsSettingStateInterface::ROUTING_PATH => 'section/events/routing',
                ][$configPath] ?? $configPath;
            }
        };
    }
}
