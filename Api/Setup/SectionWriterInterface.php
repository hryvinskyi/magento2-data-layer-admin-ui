<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Api\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterface;
use Magento\Framework\Exception\LocalizedException;

/**
 * Saves fields of one configuration section at a scope, exactly as the configuration page saves its form
 *
 * Each field goes through its own save rules (its backend model), and the section's change event is announced once
 * per call.
 *
 * @api
 */
interface SectionWriterInterface
{
    /**
     * Save the fields of a section at a scope
     *
     * Rows to inherit are removed first, then the values are written; when a value is refused, none of the call's
     * values is written, though its removed rows stay removed.
     *
     * @param ScopeIdInterface $scope
     * @param string $section The section id
     * @param array<string,mixed> $groups The section's groups as the configuration page posts them
     * @return void
     * @throws LocalizedException When a field refuses its value; the message is meant for the person saving
     * @throws \Exception When the save fails for another reason
     */
    public function write(ScopeIdInterface $scope, string $section, array $groups): void;
}
