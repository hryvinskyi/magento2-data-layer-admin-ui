<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Test\Unit\Model\Setup;

use Hryvinskyi\DataLayer\Api\ConfigInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\BuiltInDefaultsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopeTreeInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingDescriptorsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingLocksInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\StoredSettingsInterface;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Data\SettingDescriptor;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\EventsSettingState;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\FlagKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\NumberKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\SecretKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind\TextKind;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\PatternTranslator;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\ScopedValuesReader;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SettingKinds;
use Hryvinskyi\DataLayerAdminUi\Model\Setup\SetupStateProvider;
use PHPUnit\Framework\TestCase;

/**
 * The wizard's state reports each fact a scope has of its own under that scope's id, never a scope outside the tree
 * or below a setting's reach, the deployment configuration's value where it fixes a setting, and a secret only as
 * whether it is set
 */
class SetupStateProviderTest extends TestCase
{
    use EventsFixture;

    private const SECRET = 'n0t-for-the-browser';
    private const LOCK = 'Fixed by the deployment configuration.';

    /**
     * The scope tree is reported as read
     *
     * @return void
     */
    public function testScopesAreReportedAsRead(): void
    {
        $state = $this->provider()->getState();

        self::assertSame($this->scopes(), $state['scopes']);
    }

    /**
     * Rows at the default scope, a website and a store view appear under `default`, `website:<id>` and
     * `store:<id>`; a row of a website or store view outside the tree, and a store-view row of a website-only
     * setting, are not reported
     *
     * @return void
     */
    public function testOwnValuesAppearUnderTheirScopeIds(): void
    {
        $settings = $this->settings();

        self::assertSame(
            ['default' => 'GTM-DEF', 'website:1' => 'GTM-WEB', 'store:1' => 'GTM-STORE', 'website:2' => 'GTM-ENV'],
            $settings['container_id']['values']
        );
        self::assertSame(
            ['default' => ['set' => true], 'website:1' => ['set' => false]],
            $settings['api_secret']['values']
        );
        self::assertSame(['default' => '3'], $settings['retries']['values']);
    }

    /**
     * A scope the deployment configuration fixes reports the value the store reads there and why it cannot change
     *
     * @return void
     */
    public function testLockedScopeReportsItsFixedValue(): void
    {
        $settings = $this->settings();

        self::assertSame(['website:2' => self::LOCK], $settings['container_id']['locks']);
    }

    /**
     * A secret is reported only as whether it is set, never its value, anywhere in the state
     *
     * @return void
     */
    public function testSecretNeverAppears(): void
    {
        $state = $this->provider()->getState();
        $json = json_encode($state, JSON_THROW_ON_ERROR);

        self::assertStringNotContainsString(self::SECRET, $json);
        self::assertSame(['set' => true], $this->settings()['api_secret']['builtIn']);
    }

    /**
     * Each setting carries its description, the label, options and reach of its field, and its shipped value; a
     * pattern is translated for the browser, bounds and case-insensitivity appear only on the settings that have them
     *
     * @return void
     */
    public function testSettingDescriptions(): void
    {
        $settings = $this->settings();

        self::assertSame(['enabled', 'container_id', 'measurement_id', 'api_secret', 'retries'], array_keys($settings));
        self::assertSame('flag', $settings['enabled']['kind']);
        self::assertSame('connect', $settings['enabled']['step']);
        self::assertSame('Label of enabled', $settings['enabled']['label']);
        self::assertSame(
            [['value' => '1', 'label' => 'Yes'], ['value' => '0', 'label' => 'No']],
            $settings['enabled']['options']
        );
        self::assertSame('store', $settings['enabled']['reach']);
        self::assertSame('website', $settings['api_secret']['reach']);
        self::assertTrue($settings['enabled']['builtIn']);
        self::assertSame('', $settings['container_id']['builtIn']);
        self::assertSame(['source' => '^GTM-[A-Z0-9]+$', 'flags' => ''], $settings['container_id']['pattern'] ?? null);
        self::assertSame(1, $settings['retries']['min'] ?? null);
        self::assertSame(5, $settings['retries']['max'] ?? null);
        self::assertArrayNotHasKey('min', $settings['container_id']);
        self::assertTrue($settings['measurement_id']['caseInsensitive'] ?? false);
        foreach (['enabled', 'container_id', 'api_secret', 'retries'] as $key) {
            self::assertArrayNotHasKey('caseInsensitive', $settings[$key], $key);
        }
    }

    /**
     * A map with nothing in it encodes as an empty JSON object, so the browser reads it as a map
     *
     * @return void
     */
    public function testEmptyMapsEncodeAsObjects(): void
    {
        $settings = $this->settings();

        self::assertSame('{"values":{},"locks":{}}', json_encode(
            ['values' => $settings['measurement_id']['values'], 'locks' => $settings['enabled']['locks']],
            JSON_THROW_ON_ERROR
        ));
        self::assertSame(
            '{"off":["login"],"channels":{}}',
            json_encode($this->provider()->getState()['events']['builtIn'], JSON_THROW_ON_ERROR)
        );
    }

    /**
     * A setting whose configuration section the user may not open is not reported at all; the events setting stays
     *
     * @return void
     */
    public function testSettingTheUserMayNotChangeIsLeftOut(): void
    {
        $state = $this->provider(['section/remote/api_secret', 'section/gtm/container_id'])->getState();

        self::assertSame(['enabled', 'measurement_id', 'retries'], array_column($state['settings'], 'key'));
        self::assertSame(
            ['view_item', 'purchase', 'login', 'sample_server_event', 'ads_conversion'],
            array_column($state['events']['catalogue'], 'name')
        );
    }

    /**
     * The events setting is set at a scope when either of its paths is; the path not set there is inherited, entries
     * for unknown events are left out, and a lock on either path locks the setting
     *
     * @return void
     */
    public function testEventsSetting(): void
    {
        $events = $this->provider()->getState()['events'];

        $catalogue = ['view_item', 'purchase', 'login', 'sample_server_event', 'ads_conversion'];
        self::assertSame($catalogue, array_column(
            $events['catalogue'],
            'name'
        ));
        self::assertSame(['full', 'lean'], array_column($events['presets'], 'key'));
        self::assertEquals(['off' => ['login'], 'channels' => (object) []], $events['builtIn']);
        self::assertEquals([
            'website:1' => ['off' => ['purchase'], 'channels' => (object) []],
            'store:2' => ['off' => ['purchase'], 'channels' => ['view_item' => 'server']],
            'store:3' => ['off' => ['login'], 'channels' => ['purchase' => 'both']],
        ], $events['values']);
        self::assertSame(['store:3' => self::LOCK], $events['locks']);
    }

    /**
     * Read the settings of the state, keyed by setting key
     *
     * @return array<string, array<string, mixed>>
     */
    private function settings(): array
    {
        $settings = [];
        foreach ($this->provider()->getState()['settings'] as $setting) {
            $settings[$setting['key']] = $setting;
        }

        return $settings;
    }

    /**
     * Build the provider over fakes of every reader except the kinds, the translator and the events setting
     *
     * @param list<string> $denied Config paths of settings the user may not change
     * @return SetupStateProvider
     */
    private function provider(array $denied = []): SetupStateProvider
    {
        return new SetupStateProvider(
            $this->descriptors(),
            new SettingKinds([
                'flag' => new FlagKind(),
                'text' => new TextKind(),
                'number' => new NumberKind(),
                'secret' => new SecretKind(),
            ]),
            new ScopedValuesReader(
                $this->scopeTree(),
                $this->storedSettings(),
                $this->builtInDefaults(),
                $this->locks(),
                new ScopedValuesFactoryStub()
            ),
            $this->presentation(),
            new PatternTranslator(),
            new EventsSettingState($this->presentation(), $this->eventsProjection()),
            new AccessStub($denied)
        );
    }

    /**
     * The scope tree: two websites, the first with two store views, the second with one
     *
     * @return list<array{id: string, type: 'default'|'website'|'store', name: string, code: string,
     *     domain?: string, parent: string|null}>
     */
    private function scopes(): array
    {
        return [
            ['id' => 'default', 'type' => 'default', 'name' => 'Default Config', 'code' => '', 'parent' => null],
            ['id' => 'website:1', 'type' => 'website', 'name' => 'Main', 'code' => 'base', 'domain' => 'shop.test',
                'parent' => 'default'],
            ['id' => 'store:1', 'type' => 'store', 'name' => 'English', 'code' => 'en', 'parent' => 'website:1'],
            ['id' => 'store:2', 'type' => 'store', 'name' => 'Danish', 'code' => 'dk', 'parent' => 'website:1'],
            ['id' => 'website:2', 'type' => 'website', 'name' => 'Trade', 'code' => 'trade', 'parent' => 'default'],
            ['id' => 'store:3', 'type' => 'store', 'name' => 'Trade view', 'code' => 'tr', 'parent' => 'website:2'],
        ];
    }

    /**
     * A scope tree answering the fixture's scopes
     *
     * @return ScopeTreeInterface
     */
    private function scopeTree(): ScopeTreeInterface
    {
        $scopes = $this->scopes();

        return new class ($scopes) implements ScopeTreeInterface {
            /**
             * @param list<array{id: string, type: 'default'|'website'|'store', name: string, code: string,
             *     domain?: string, parent: string|null}> $scopes
             */
            public function __construct(private readonly array $scopes)
            {
            }

            /**
             * @inheritDoc
             */
            public function getScopes(): array
            {
                return $this->scopes;
            }
        };
    }

    /**
     * Five settings: a flag, a pattern-checked text, a case-insensitive text, a website-only secret and a
     * default-only number with bounds
     *
     * @return SettingDescriptorsInterface
     */
    private function descriptors(): SettingDescriptorsInterface
    {
        return new class implements SettingDescriptorsInterface {
            /**
             * @inheritDoc
             */
            public function getDescriptors(): array
            {
                return [
                    new SettingDescriptor('enabled', 'section/general/enabled', 'flag', 'connect'),
                    new SettingDescriptor(
                        'container_id',
                        'section/gtm/container_id',
                        'text',
                        'connect',
                        ConfigInterface::CONTAINER_ID_PATTERN
                    ),
                    new SettingDescriptor(
                        'measurement_id',
                        'section/gtag/measurement_id',
                        'text',
                        'connect',
                        ConfigInterface::MEASUREMENT_ID_PATTERN,
                        true
                    ),
                    new SettingDescriptor('api_secret', 'section/remote/api_secret', 'secret', 'remote'),
                    new SettingDescriptor('retries', 'section/remote/retries', 'number', 'remote', null, false, 1, 5),
                ];
            }

            /**
             * @inheritDoc
             */
            public function get(string $key): SettingDescriptorInterface
            {
                foreach ($this->getDescriptors() as $descriptor) {
                    if ($descriptor->getKey() === $key) {
                        return $descriptor;
                    }
                }
                throw new \InvalidArgumentException($key);
            }
        };
    }

    /**
     * Stored rows, including rows of a deleted website and store view and a store-view row of a website-only setting
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
                return [
                    'section/gtm/container_id' => [
                        'default' => 'GTM-DEF',
                        'website:1' => 'GTM-WEB',
                        'store:1' => 'GTM-STORE',
                        'website:2' => 'GTM-STORED',
                        'store:99' => 'GTM-ORPHAN',
                        'website:9' => 'GTM-ORPHAN',
                    ],
                    'section/remote/api_secret' => [
                        'default' => SetupStateProviderTest::secret(),
                        'website:1' => '',
                        'store:2' => SetupStateProviderTest::secret(),
                    ],
                    'section/remote/retries' => ['default' => '3', 'website:1' => '4'],
                    'hryvinskyi_datalayer/events/disabled' => [
                        'website:1' => 'purchase,old_event',
                        'store:99' => 'login',
                    ],
                    'hryvinskyi_datalayer/channels/routing' => [
                        'store:2' => '[{"event":"view_item","channel":"server"},'
                            . '{"event":"old_event","channel":"server"}]',
                    ],
                ];
            }
        };
    }

    /**
     * Shipped values: the flag on, the secret set, one event off
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
                $shipped = array_fill_keys($paths, null);
                $shipped['section/general/enabled'] = '1';
                $shipped['section/remote/api_secret'] = SetupStateProviderTest::secret();
                $shipped['hryvinskyi_datalayer/events/disabled'] = 'login';

                return $shipped;
            }
        };
    }

    /**
     * Locks: the container id at the second website, the routing at its store view, and a lock outside the tree
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
                $lock = static fn (?string $value): array => [
                    'message' => 'Fixed by the deployment configuration.',
                    'value' => $value,
                ];

                return [
                    'section/gtm/container_id' => ['website:2' => $lock('GTM-ENV'), 'store:99' => $lock('GTM-X')],
                    'hryvinskyi_datalayer/channels/routing' => [
                        'store:3' => $lock('[{"event":"purchase","channel":"both"}]'),
                    ],
                ];
            }
        };
    }

    /**
     * Fields for every path: labelled after the key, store-view reach except the website-only secret and the
     * default-only number, Yes/No options for the flag
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
                $reaches = ['section/remote/api_secret' => 'website', 'section/remote/retries' => 'default'];

                return [
                    'label' => 'Label of ' . $key,
                    'options' => $key === 'enabled'
                        ? [['value' => '1', 'label' => 'Yes'], ['value' => '0', 'label' => 'No']]
                        : [],
                    'reach' => $reaches[$path] ?? 'store',
                ];
            }
        };
    }

    /**
     * The secret stored in the fixture
     *
     * @return string
     */
    public static function secret(): string
    {
        return self::SECRET;
    }
}
