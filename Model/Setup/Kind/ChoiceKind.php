<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup\Kind;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\SettingDescriptorInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\InvalidSetupRequestException;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingKindInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingPresentationInterface;

/**
 * A setting whose value is one of a list of choices
 *
 * Shown as the stored text, empty when nothing is stored; stored trimmed. A value is taken only when it is one of the
 * options the configuration page's field offers for the setting's path, the same list the wizard shows.
 */
class ChoiceKind implements SettingKindInterface
{
    /**
     * @param SettingPresentationInterface $presentation Gives the options of the setting's field
     */
    public function __construct(
        private readonly SettingPresentationInterface $presentation
    ) {
    }

    /**
     * @inheritDoc
     */
    public function getCode(): string
    {
        return 'choice';
    }

    /**
     * @inheritDoc
     */
    public function present(?string $stored): string
    {
        return $stored ?? '';
    }

    /**
     * @inheritDoc
     */
    public function toStored(SettingDescriptorInterface $setting, mixed $wire): string
    {
        $key = $setting->getKey();
        if (!is_string($wire)) {
            throw new InvalidSetupRequestException(__('The setting "%1" takes text.', $key));
        }
        $value = trim($wire);
        foreach ($this->presentation->present($key, $setting->getPath())['options'] as $option) {
            if ($option['value'] === $value) {
                return $value;
            }
        }

        throw new InvalidSetupRequestException(__('"%1" is not one of the choices of the setting "%2".', $value, $key));
    }

    /**
     * @inheritDoc
     */
    public function isPreviewable(): bool
    {
        return true;
    }
}
