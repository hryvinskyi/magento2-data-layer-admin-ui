<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Form;

use Hryvinskyi\DataLayerAdminUi\Api\Form\SettingsGroupLinkInterface;

/**
 * Builds the configuration page's route parameters for a group
 *
 * The page names each group's heading after the group's path (`section/group`, or `section/group/subgroup` for a
 * group inside another), with `/` turned into `_` and `-link` added; the address ends in that anchor, so the browser
 * scrolls to the group.
 */
class SettingsGroupLink implements SettingsGroupLinkInterface
{
    /**
     * @inheritDoc
     */
    public function routeParams(string $groupPath, ?int $websiteId): array
    {
        $parts = explode('/', $groupPath);
        if (count($parts) < 2 || in_array('', $parts, true)) {
            throw new \InvalidArgumentException(sprintf(
                'The settings group "%s" is not a section followed by a group.',
                $groupPath
            ));
        }
        $params = ['section' => $parts[0]];
        if ($websiteId !== null) {
            $params['website'] = $websiteId;
        }
        $params['_fragment'] = implode('_', $parts) . '-link';

        return $params;
    }
}
