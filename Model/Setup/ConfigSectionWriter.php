<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\Data\ScopeIdInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SectionWriterInterface;
use Magento\Config\Model\ConfigFactory;

/**
 * Saves a section through a fresh configuration model, the one the configuration page's save uses
 *
 * The model re-reads the configuration, removes and writes the rows, re-reads it again and announces the section's
 * change, so every rule and reaction of the configuration page applies.
 */
class ConfigSectionWriter implements SectionWriterInterface
{
    /**
     * @param ConfigFactory $configFactory
     */
    public function __construct(
        private readonly ConfigFactory $configFactory
    ) {
    }

    /**
     * @inheritDoc
     */
    public function write(ScopeIdInterface $scope, string $section, array $groups): void
    {
        $this->configFactory->create(['data' => [
            'section' => $section,
            'website' => $scope->getType() === 'website' ? $scope->getId() : null,
            'store' => $scope->getType() === 'store' ? $scope->getId() : null,
            'groups' => $groups,
        ]])->save();
    }
}
