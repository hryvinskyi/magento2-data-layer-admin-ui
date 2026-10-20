<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\PreviewDraftInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SettingFieldsPoolInterface;

/**
 * Drafts each wizard setting the way the setting is saved: the same way of saving the saver uses turns its value into
 * the config values to draft
 *
 * A setting's value goes through the same rules as when it is saved, so a drafted value reads exactly as the same
 * value would once saved (a case-insensitive one in capitals) and a value the save would refuse is refused here too.
 */
class PreviewDraft implements PreviewDraftInterface
{
    /**
     * @param SettingFieldsPoolInterface $settingFields
     */
    public function __construct(
        private readonly SettingFieldsPoolInterface $settingFields
    ) {
    }

    /**
     * @inheritDoc
     */
    public function toDraft(array $settings): array
    {
        $draft = [];
        foreach ($settings as $key => $value) {
            $key = (string) $key;
            $draft = array_replace($draft, $this->settingFields->get($key)->toPreviewDraft($key, $value));
        }

        return $draft;
    }
}
