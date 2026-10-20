<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\ConfigFieldLookupInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;

/**
 * Reads a setting's label, options and reach from the configuration page's field stored under the same path
 *
 * A field that stores its value under another path (`config_path`) is found by that path; a path without a field, as
 * the field lookup decides it, is refused. Option groups are flattened into their options.
 *
 * @phpstan-import-type Option from SettingPresentationInterface
 */
class SettingPresentation implements SettingPresentationInterface
{
    /**
     * @param ConfigFieldLookupInterface $fields
     */
    public function __construct(
        private readonly ConfigFieldLookupInterface $fields
    ) {
    }

    /**
     * @inheritDoc
     */
    public function present(string $key, string $path): array
    {
        $field = $this->fields->find($path);
        if ($field === null) {
            throw new \InvalidArgumentException(sprintf(
                'The wizard setting "%s" is stored under %s, but the configuration page has no field there.',
                $key,
                $path
            ));
        }

        return [
            'label' => trim((string) $field->getLabel()),
            'options' => $this->options($field->getOptions()),
            'reach' => match (true) {
                $field->showInStore() => 'store',
                $field->showInWebsite() => 'website',
                default => 'default',
            },
        ];
    }

    /**
     * Normalise a field's options into a flat list of text values and labels
     *
     * @param mixed $options As the source model gave them: options, or groups of options under `value`
     * @return list<Option>
     */
    private function options(mixed $options): array
    {
        $flat = [];
        foreach (is_array($options) ? $options : [] as $option) {
            if (!is_array($option)) {
                continue;
            }
            $value = $option['value'] ?? null;
            if (is_array($value)) {
                array_push($flat, ...$this->options($value));
                continue;
            }
            $flat[] = [
                'value' => is_scalar($value) ? (string) $value : '',
                'label' => $this->text($option['label'] ?? ''),
            ];
        }

        return $flat;
    }

    /**
     * Read an option label, which a source model may give as a phrase
     *
     * @param mixed $label
     * @return string
     */
    private function text(mixed $label): string
    {
        return is_scalar($label) || $label instanceof \Stringable ? (string) $label : '';
    }
}
