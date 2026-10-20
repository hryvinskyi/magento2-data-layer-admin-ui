<?php
/**
 * Copyright (c) 2026. Volodymyr Hryvinskyi. All rights reserved.
 * Author: Volodymyr Hryvinskyi <volodymyr@hryvinskyi.com>
 * GitHub: https://github.com/hryvinskyi
 */

declare(strict_types=1);

namespace Hryvinskyi\DataLayerAdminUi\Model\Setup;

use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionInterface;
use Hryvinskyi\DataLayerAdminUi\Api\Setup\SetupContributionsInterface;

/**
 * The contributions registered in `di.xml`; an item that is not a contribution fails when the pool is built
 */
class SetupContributions implements SetupContributionsInterface
{
    /**
     * @var list<SetupContributionInterface>
     */
    private readonly array $contributions;

    /**
     * @param array<mixed> $contributions Each module's contribution, keyed by a name of the module's choice
     * @throws \InvalidArgumentException When an item is not a contribution
     */
    public function __construct(array $contributions = [])
    {
        $registered = [];
        foreach ($contributions as $name => $contribution) {
            if (!$contribution instanceof SetupContributionInterface) {
                throw new \InvalidArgumentException(sprintf(
                    'The setup contribution "%s" must implement %s.',
                    (string) $name,
                    SetupContributionInterface::class
                ));
            }
            $registered[] = $contribution;
        }
        $this->contributions = $registered;
    }

    /**
     * @inheritDoc
     */
    public function getContributions(): array
    {
        return $this->contributions;
    }
}
