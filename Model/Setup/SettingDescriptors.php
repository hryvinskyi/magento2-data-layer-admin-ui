<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterfaceFactory;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingDescriptorsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindsInterface;

/**
 * The wizard settings registered in `di.xml`, checked when the list is built
 *
 * Each item is keyed by the setting's key and gives its `path`, `kind` and `step`, and optionally a `pattern`
 * (a PCRE constant), `caseInsensitive`, `min` and `max`. A registration of the wrong shape, a kind no strategy
 * handles, or a second setting stored under the same path fails loudly, so a mistyped registration is found on the
 * first page load rather than shown as a broken field.
 */
class SettingDescriptors implements SettingDescriptorsInterface
{
    /**
     * @var list<SettingDescriptorInterface>
     */
    private readonly array $descriptors;

    /**
     * @var array<string, SettingDescriptorInterface>
     */
    private readonly array $byKey;

    /**
     * @param SettingDescriptorInterfaceFactory $descriptorFactory
     * @param SettingKindsInterface $kinds
     * @param array<mixed> $descriptors Each setting's registration, keyed by setting key
     * @throws \InvalidArgumentException When a registration is unusable, names an unknown kind or repeats a path
     */
    public function __construct(
        SettingDescriptorInterfaceFactory $descriptorFactory,
        SettingKindsInterface $kinds,
        array $descriptors = []
    ) {
        $built = [];
        $byKey = [];
        $keysByPath = [];
        foreach ($descriptors as $key => $registration) {
            $key = (string) $key;
            if (!is_array($registration)) {
                throw new \InvalidArgumentException(
                    sprintf('The wizard setting "%s" must be registered as an array.', $key)
                );
            }
            $descriptor = $descriptorFactory->create([
                'key' => $key,
                'path' => $this->text($key, 'path', $registration['path'] ?? null),
                'kind' => $this->text($key, 'kind', $registration['kind'] ?? null),
                'step' => $this->text($key, 'step', $registration['step'] ?? null),
                'pattern' => $this->optionalText($key, 'pattern', $registration['pattern'] ?? null),
                'caseInsensitive' => $this->flag($key, $registration['caseInsensitive'] ?? false),
                'min' => $this->bound($key, 'min', $registration['min'] ?? null),
                'max' => $this->bound($key, 'max', $registration['max'] ?? null),
            ]);
            $kinds->get($descriptor->getKind());
            $path = $descriptor->getPath();
            if (isset($keysByPath[$path])) {
                throw new \InvalidArgumentException(sprintf(
                    'The wizard settings "%s" and "%s" are both stored under %s.',
                    $keysByPath[$path],
                    $key,
                    $path
                ));
            }
            $keysByPath[$path] = $key;
            $built[] = $descriptor;
            $byKey[$key] = $descriptor;
        }
        $this->descriptors = $built;
        $this->byKey = $byKey;
    }

    /**
     * @inheritDoc
     */
    public function getDescriptors(): array
    {
        return $this->descriptors;
    }

    /**
     * @inheritDoc
     */
    public function get(string $key): SettingDescriptorInterface
    {
        return $this->byKey[$key] ?? throw new InvalidSetupRequestException(
            __('No wizard setting is registered under "%1".', $key)
        );
    }

    /**
     * Read a required text value of a registration
     *
     * @param string $key
     * @param string $name
     * @param mixed $value
     * @return string
     * @throws \InvalidArgumentException When the value is not text
     */
    private function text(string $key, string $name, mixed $value): string
    {
        if (!is_string($value)) {
            throw new \InvalidArgumentException(
                sprintf('The wizard setting "%s" needs its %s as text.', $key, $name)
            );
        }

        return $value;
    }

    /**
     * Read an optional text value of a registration
     *
     * @param string $key
     * @param string $name
     * @param mixed $value
     * @return string|null Null when absent
     * @throws \InvalidArgumentException When the value is neither absent nor text
     */
    private function optionalText(string $key, string $name, mixed $value): ?string
    {
        return $value === null ? null : $this->text($key, $name, $value);
    }

    /**
     * Read the case-insensitivity of a registration
     *
     * @param string $key
     * @param mixed $value
     * @return bool
     * @throws \InvalidArgumentException When the value is not a boolean
     */
    private function flag(string $key, mixed $value): bool
    {
        if (!is_bool($value)) {
            throw new \InvalidArgumentException(
                sprintf('The wizard setting "%s" needs caseInsensitive as a boolean.', $key)
            );
        }

        return $value;
    }

    /**
     * Read an optional numeric bound of a registration
     *
     * @param string $key
     * @param string $name
     * @param mixed $value
     * @return int|null Null when absent
     * @throws \InvalidArgumentException When the value is neither absent nor a whole number
     */
    private function bound(string $key, string $name, mixed $value): ?int
    {
        if ($value === null) {
            return null;
        }
        $bound = filter_var($value, FILTER_VALIDATE_INT);
        if (!is_int($bound)) {
            throw new \InvalidArgumentException(
                sprintf('The wizard setting "%s" needs its %s as a whole number.', $key, $name)
            );
        }

        return $bound;
    }
}
