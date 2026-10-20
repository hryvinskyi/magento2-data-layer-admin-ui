<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\EventsSettingStateInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\PatternTranslatorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\ScopedValuesReaderInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingAccessInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingDescriptorsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupStateProviderInterface;

/**
 * Assembles the setup wizard's state from the scope tree, the registered settings and what is stored, shipped and
 * fixed for each, read in one pass over every path
 *
 * A scope reports a value or a lock only when it is in the scope tree and within the setting's reach. A setting the
 * signed-in user may not change is left out altogether, as if it were not registered. The events setting is described
 * by its own reader over the same values.
 *
 * @phpstan-import-type Setting from SetupStateProviderInterface
 */
class SetupStateProvider implements SetupStateProviderInterface
{
    /**
     * @param SettingDescriptorsInterface $descriptors
     * @param SettingKindsInterface $kinds
     * @param ScopedValuesReaderInterface $valuesReader
     * @param SettingPresentationInterface $presentation
     * @param PatternTranslatorInterface $patternTranslator
     * @param EventsSettingStateInterface $eventsSetting
     * @param SettingAccessInterface $access
     */
    public function __construct(
        private readonly SettingDescriptorsInterface $descriptors,
        private readonly SettingKindsInterface $kinds,
        private readonly ScopedValuesReaderInterface $valuesReader,
        private readonly SettingPresentationInterface $presentation,
        private readonly PatternTranslatorInterface $patternTranslator,
        private readonly EventsSettingStateInterface $eventsSetting,
        private readonly SettingAccessInterface $access
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getState(): array
    {
        $descriptors = array_values(array_filter(
            $this->descriptors->getDescriptors(),
            fn (SettingDescriptorInterface $descriptor): bool => $this->access->isAllowed($descriptor->getPath())
        ));
        $paths = array_map(
            static fn (SettingDescriptorInterface $descriptor): string => $descriptor->getPath(),
            $descriptors
        );
        array_push($paths, EventsSettingStateInterface::DISABLED_PATH, EventsSettingStateInterface::ROUTING_PATH);
        $values = $this->valuesReader->read($paths);

        $settings = [];
        foreach ($descriptors as $descriptor) {
            $settings[] = $this->setting($descriptor, $values);
        }

        return [
            'scopes' => $values->getScopes(),
            'settings' => $settings,
            'events' => $this->eventsSetting->describe($values),
        ];
    }

    /**
     * Describe one setting with its values
     *
     * @param SettingDescriptorInterface $descriptor
     * @param ScopedValuesInterface $values
     * @return Setting
     * @throws \InvalidArgumentException When the setting has no field on the configuration page, names an unknown
     *     kind or a pattern the browser cannot use
     */
    private function setting(SettingDescriptorInterface $descriptor, ScopedValuesInterface $values): array
    {
        $key = $descriptor->getKey();
        $path = $descriptor->getPath();
        $presentation = $this->presentation->present($key, $path);
        $kind = $this->kinds->get($descriptor->getKind());
        $reach = $presentation['reach'];

        $own = [];
        foreach ($values->getOwn($path, $reach) as $scopeId => $raw) {
            $own[$scopeId] = $kind->present($raw);
        }

        $setting = [
            'key' => $key,
            'path' => $path,
            'kind' => $kind->getCode(),
            'step' => $descriptor->getStep(),
            'label' => $presentation['label'],
            'options' => $presentation['options'],
            'reach' => $reach,
            'builtIn' => $kind->present($values->getBuiltIn($path)),
            'values' => $this->map($own),
            'locks' => $this->map($values->getLocks([$path => $reach])),
        ];
        $pattern = $descriptor->getPattern();
        if ($pattern !== null) {
            $setting['pattern'] = $this->patternTranslator->toEcmaScript($pattern);
        }
        if ($descriptor->getMin() !== null) {
            $setting['min'] = $descriptor->getMin();
        }
        if ($descriptor->getMax() !== null) {
            $setting['max'] = $descriptor->getMax();
        }
        if ($descriptor->isCaseInsensitive()) {
            $setting['caseInsensitive'] = true;
        }

        return $setting;
    }

    /**
     * Keep a map an object when it is empty, so it encodes as a JSON object rather than an empty list
     *
     * @template T
     * @param array<string,T> $map
     * @return array<string, T>|\stdClass
     */
    private function map(array $map): array|\stdClass
    {
        return $map === [] ? (object) [] : $map;
    }
}
