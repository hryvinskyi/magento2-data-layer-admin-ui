<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Fields;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopedValuesInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingDescriptorsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindsInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;

/**
 * Saves a registered wizard setting: one path, reaching the scopes its configuration page field shows at, posted with
 * the value its kind stores
 *
 * A secret is posted as the new plain text, which the field's own save rules encrypt, as on the configuration page.
 * Whether a setting is drafted for an event preview is its kind's to say.
 */
class RegisteredSettingFields implements SettingFieldsInterface
{
    /**
     * @param SettingDescriptorsInterface $descriptors
     * @param SettingKindsInterface $kinds
     * @param SettingPresentationInterface $presentation
     */
    public function __construct(
        private readonly SettingDescriptorsInterface $descriptors,
        private readonly SettingKindsInterface $kinds,
        private readonly SettingPresentationInterface $presentation
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getReaches(string $key): array
    {
        $path = $this->descriptors->get($key)->getPath();

        return [$path => $this->presentation->present($key, $path)['reach']];
    }

    /**
     * @inheritDoc
     */
    public function toFieldValues(string $key, mixed $value, string $scopeId, ScopedValuesInterface $values): array
    {
        $descriptor = $this->descriptors->get($key);

        return [
            $descriptor->getPath() => $this->kinds->get($descriptor->getKind())->toStored($descriptor, $value),
        ];
    }

    /**
     * @inheritDoc
     */
    public function toPreviewDraft(string $key, mixed $value): array
    {
        $descriptor = $this->descriptors->get($key);
        $kind = $this->kinds->get($descriptor->getKind());

        return $kind->isPreviewable() ? [$descriptor->getPath() => $kind->toStored($descriptor, $value)] : [];
    }
}
